import { logError as _ulogError } from '@/lib/logging/core'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadToCOS, getSignedUrl, toFetchableUrl, generateUniqueKey } from '@/lib/cos'
import { decodeImageUrlsFromDb, encodeImageUrls } from '@/lib/contracts/image-urls-contract'
import { resolveStorageKeyFromMediaValue } from '@/lib/media/service'
import sharp from 'sharp'
import { initializeFonts, createLabelSVG } from '@/lib/fonts'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { runSideEffectWithWarning, type SideEffectWarning } from '@/lib/api/side-effect-warning'

/**
 * POST /api/novel-promotion/[projectId]/update-asset-label
 * 更新资产图片上的黑边标识符（修改名字后调用）
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  // 初始化字体（在 Vercel 环境中需要）
  await initializeFonts()

  // 🔐 统一权限验证
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const { type, id, newName, appearanceIndex } = body
  // type: 'character' | 'location'
  // id: characterId 或 locationId
  // newName: 新名字
  // appearanceIndex: 角色形象索引（仅角色需要）

  if (!type || !id || !newName) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (type === 'character') {
    const labelWarnings: SideEffectWarning[] = []
    // 获取角色的所有形象
    const character = await prisma.novelPromotionCharacter.findUnique({
      where: { id: id },
      include: { appearances: true }
    })

    if (!character) {
      throw new ApiError('NOT_FOUND')
    }

    // 更新每个形象的图片标签
    const updatePromises = character.appearances.map(async (appearance) => {
      // 如果指定了 appearanceIndex，只更新该形象
      if (appearanceIndex !== undefined && appearance.appearanceIndex !== appearanceIndex) {
        return null
      }

      // 获取图片 URLs
      let imageUrls =
        typeof appearance.imageUrls === 'string'
          ? decodeImageUrlsFromDb(appearance.imageUrls, 'characterAppearance.imageUrls')
          : []
      if (imageUrls.length === 0 && appearance.imageUrl) {
        imageUrls = [appearance.imageUrl]
      }

      if (imageUrls.length === 0) return null

      // 更新每张图片的标签
      const newLabelText = `${newName} - ${appearance.changeReason}`
      const newImageUrls: string[] = await Promise.all(
        imageUrls.map(async (url, i) => {
          if (!url) return ''
          let nextUrl = url
          const warning = await runSideEffectWithWarning({
            code: 'NOVEL_ASSET_LABEL_UPDATE_FAILED',
            target: `characterAppearance:${appearance.id}:image:${i}`,
            logPrefix: '[Update Asset Label API] 角色图片标签更新失败',
            run: async () => {
              nextUrl = await updateImageLabel(url, newLabelText)
            },
          })
          if (warning) {
            labelWarnings.push(warning)
            _ulogError(`Failed to update label for image ${i}:`, warning.detail)
          }
          return nextUrl
        })
      )

      const firstUrl = newImageUrls.find((u) => !!u) || null

      // 更新数据库
      await prisma.characterAppearance.update({
        where: { id: appearance.id },
        data: {
          imageUrls: encodeImageUrls(newImageUrls),
          imageUrl: firstUrl
        }
      })

      return { appearanceIndex: appearance.appearanceIndex, imageUrls: newImageUrls }
    })

    const results = await Promise.all(updatePromises)
    return NextResponse.json({
      success: true,
      results: results.filter(r => r !== null),
      labelWarningCount: labelWarnings.length,
      labelWarnings,
    })

  } else if (type === 'location') {
    const labelWarnings: SideEffectWarning[] = []
    // 获取场景
    const location = await prisma.novelPromotionLocation.findUnique({
      where: { id: id },
      include: { images: true }
    })

    if (!location) {
      throw new ApiError('NOT_FOUND')
    }

    // 更新每张图片的标签
    const updatePromises = location.images.map(async (image) => {
      if (!image.imageUrl) return null

      const newLabelText = newName
      let newImageUrl: string | null = null
      const warning = await runSideEffectWithWarning({
        code: 'NOVEL_ASSET_LABEL_UPDATE_FAILED',
        target: `locationImage:${image.id}`,
        logPrefix: '[Update Asset Label API] 场景图片标签更新失败',
        run: async () => {
          newImageUrl = await updateImageLabel(
            image.imageUrl as string,
            newLabelText,
          )
        },
      })
      if (warning) {
        labelWarnings.push(warning)
        _ulogError(`Failed to update label for location image ${image.imageIndex}:`, warning.detail)
        return null
      }
      if (!newImageUrl) return null

      // 更新数据库
      await prisma.locationImage.update({
        where: { id: image.id },
        data: { imageUrl: newImageUrl }
      })

      return { imageIndex: image.imageIndex, imageUrl: newImageUrl }
    })

    const results = await Promise.all(updatePromises)
    return NextResponse.json({
      success: true,
      results: results.filter(r => r !== null),
      labelWarningCount: labelWarnings.length,
      labelWarnings,
    })
  }

  throw new ApiError('INVALID_PARAMS')
})

/**
 * 更新图片的黑边标签
 * 🔥 生成新的 COS key 上传，使 URL 发生变化，浏览器缓存自动失效，前端能看到新标签
 */
async function updateImageLabel(imageUrl: string, newLabelText: string): Promise<string> {
  const originalKey = await resolveStorageKeyFromMediaValue(imageUrl)
  if (!originalKey) {
    throw new Error(`无法归一化媒体 key: ${imageUrl}`)
  }
  const signedUrl = getSignedUrl(originalKey, 3600)

  // 下载图片
  const response = await fetch(toFetchableUrl(signedUrl))
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())

  // 获取图片元数据
  const meta = await sharp(buffer).metadata()
  const w = meta.width || 2160
  const h = meta.height || 2160

  // 计算标签条高度（与生成时一致：高度的 4%）
  const fontSize = Math.floor(h * 0.04)
  const pad = Math.floor(fontSize * 0.5)
  const barH = fontSize + pad * 2

  // 裁剪掉顶部的旧标签条
  const croppedBuffer = await sharp(buffer)
    .extract({ left: 0, top: barH, width: w, height: h - barH })
    .toBuffer()

  // 创建新的 SVG 标签条
  const svg = await createLabelSVG(w, barH, fontSize, pad, newLabelText)

  // 添加新标签条到图片顶部
  const processed = await sharp(croppedBuffer)
    .extend({ top: barH, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()

  // 🔥 生成新 key 上传，使图片 URL 发生变化，强制浏览器绕过缓存，确保前端能看到新标签
  const newKey = generateUniqueKey('labeled-rename', 'jpg')
  await uploadToCOS(processed, newKey)
  return newKey
}
