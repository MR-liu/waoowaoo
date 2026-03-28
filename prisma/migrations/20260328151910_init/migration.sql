-- CreateTable
CREATE TABLE `account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,

    INDEX `account_userId_idx`(`userId`),
    UNIQUE INDEX `account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `character_appearances` (
    `id` VARCHAR(191) NOT NULL,
    `characterId` VARCHAR(191) NOT NULL,
    `appearanceIndex` INTEGER NOT NULL,
    `changeReason` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `descriptions` TEXT NULL,
    `imageUrl` TEXT NULL,
    `imageUrls` TEXT NULL,
    `selectedIndex` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `previousImageUrl` TEXT NULL,
    `previousImageUrls` TEXT NULL,
    `previousDescription` TEXT NULL,
    `previousDescriptions` TEXT NULL,
    `imageMediaId` VARCHAR(191) NULL,

    INDEX `character_appearances_characterId_idx`(`characterId`),
    INDEX `character_appearances_imageMediaId_idx`(`imageMediaId`),
    UNIQUE INDEX `character_appearances_characterId_appearanceIndex_key`(`characterId`, `appearanceIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `location_images` (
    `id` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `imageIndex` INTEGER NOT NULL,
    `description` TEXT NULL,
    `imageUrl` TEXT NULL,
    `isSelected` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `previousImageUrl` TEXT NULL,
    `previousDescription` TEXT NULL,
    `imageMediaId` VARCHAR(191) NULL,

    INDEX `location_images_locationId_idx`(`locationId`),
    INDEX `location_images_imageMediaId_idx`(`imageMediaId`),
    UNIQUE INDEX `location_images_locationId_imageIndex_key`(`locationId`, `imageIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_characters` (
    `id` VARCHAR(191) NOT NULL,
    `novelPromotionProjectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `aliases` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `customVoiceUrl` TEXT NULL,
    `customVoiceMediaId` VARCHAR(191) NULL,
    `voiceId` VARCHAR(191) NULL,
    `voiceType` VARCHAR(191) NULL,
    `profileData` TEXT NULL,
    `profileConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `introduction` TEXT NULL,
    `sourceGlobalCharacterId` VARCHAR(191) NULL,

    INDEX `novel_promotion_characters_novelPromotionProjectId_idx`(`novelPromotionProjectId`),
    INDEX `novel_promotion_characters_customVoiceMediaId_idx`(`customVoiceMediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_locations` (
    `id` VARCHAR(191) NOT NULL,
    `novelPromotionProjectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sourceGlobalLocationId` VARCHAR(191) NULL,
    `selectedImageId` VARCHAR(191) NULL,

    INDEX `novel_promotion_locations_novelPromotionProjectId_idx`(`novelPromotionProjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_episodes` (
    `id` VARCHAR(191) NOT NULL,
    `novelPromotionProjectId` VARCHAR(191) NOT NULL,
    `episodeNumber` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `novelText` TEXT NULL,
    `audioUrl` TEXT NULL,
    `audioMediaId` VARCHAR(191) NULL,
    `srtContent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `speakerVoices` TEXT NULL,

    INDEX `novel_promotion_episodes_novelPromotionProjectId_idx`(`novelPromotionProjectId`),
    INDEX `novel_promotion_episodes_audioMediaId_idx`(`audioMediaId`),
    UNIQUE INDEX `novel_promotion_episodes_novelPromotionProjectId_episodeNumb_key`(`novelPromotionProjectId`, `episodeNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_editor_projects` (
    `id` VARCHAR(191) NOT NULL,
    `episodeId` VARCHAR(191) NOT NULL,
    `projectData` TEXT NOT NULL,
    `renderStatus` VARCHAR(191) NULL,
    `outputUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `video_editor_projects_episodeId_key`(`episodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_clips` (
    `id` VARCHAR(191) NOT NULL,
    `episodeId` VARCHAR(191) NOT NULL,
    `start` INTEGER NULL,
    `end` INTEGER NULL,
    `duration` INTEGER NULL,
    `summary` TEXT NOT NULL,
    `location` TEXT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `characters` TEXT NULL,
    `endText` TEXT NULL,
    `shotCount` INTEGER NULL,
    `startText` TEXT NULL,
    `screenplay` TEXT NULL,

    INDEX `novel_promotion_clips_episodeId_idx`(`episodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_panels` (
    `id` VARCHAR(191) NOT NULL,
    `storyboardId` VARCHAR(191) NOT NULL,
    `panelIndex` INTEGER NOT NULL,
    `panelNumber` INTEGER NULL,
    `shotType` TEXT NULL,
    `cameraMove` TEXT NULL,
    `description` TEXT NULL,
    `location` TEXT NULL,
    `characters` TEXT NULL,
    `srtSegment` TEXT NULL,
    `srtStart` DOUBLE NULL,
    `srtEnd` DOUBLE NULL,
    `duration` DOUBLE NULL,
    `imagePrompt` TEXT NULL,
    `imageUrl` TEXT NULL,
    `imageMediaId` VARCHAR(191) NULL,
    `imageHistory` TEXT NULL,
    `videoPrompt` TEXT NULL,
    `firstLastFramePrompt` TEXT NULL,
    `videoUrl` TEXT NULL,
    `videoGenerationMode` TEXT NULL,
    `videoMediaId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sceneType` VARCHAR(191) NULL,
    `candidateImages` TEXT NULL,
    `linkedToNextPanel` BOOLEAN NOT NULL DEFAULT false,
    `lipSyncTaskId` VARCHAR(191) NULL,
    `lipSyncVideoUrl` VARCHAR(191) NULL,
    `lipSyncVideoMediaId` VARCHAR(191) NULL,
    `sketchImageUrl` TEXT NULL,
    `sketchImageMediaId` VARCHAR(191) NULL,
    `photographyRules` TEXT NULL,
    `actingNotes` TEXT NULL,
    `previousImageUrl` TEXT NULL,
    `previousImageMediaId` VARCHAR(191) NULL,

    INDEX `novel_promotion_panels_storyboardId_idx`(`storyboardId`),
    INDEX `novel_promotion_panels_imageMediaId_idx`(`imageMediaId`),
    INDEX `novel_promotion_panels_videoMediaId_idx`(`videoMediaId`),
    INDEX `novel_promotion_panels_lipSyncVideoMediaId_idx`(`lipSyncVideoMediaId`),
    INDEX `novel_promotion_panels_sketchImageMediaId_idx`(`sketchImageMediaId`),
    INDEX `novel_promotion_panels_previousImageMediaId_idx`(`previousImageMediaId`),
    UNIQUE INDEX `novel_promotion_panels_storyboardId_panelIndex_key`(`storyboardId`, `panelIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_projects` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `analysisModel` VARCHAR(191) NULL,
    `imageModel` VARCHAR(191) NULL,
    `videoModel` VARCHAR(191) NULL,
    `videoRatio` VARCHAR(191) NOT NULL DEFAULT '9:16',
    `ttsRate` VARCHAR(191) NOT NULL DEFAULT '+50%',
    `globalAssetText` TEXT NULL,
    `artStyle` VARCHAR(191) NOT NULL DEFAULT 'american-comic',
    `artStylePrompt` TEXT NULL,
    `characterModel` VARCHAR(191) NULL,
    `locationModel` VARCHAR(191) NULL,
    `storyboardModel` VARCHAR(191) NULL,
    `editModel` VARCHAR(191) NULL,
    `videoResolution` VARCHAR(191) NOT NULL DEFAULT '720p',
    `capabilityOverrides` TEXT NULL,
    `workflowMode` VARCHAR(191) NOT NULL DEFAULT 'srt',
    `lastEpisodeId` VARCHAR(191) NULL,
    `imageResolution` VARCHAR(191) NOT NULL DEFAULT '2K',
    `importStatus` VARCHAR(191) NULL,

    UNIQUE INDEX `novel_promotion_projects_projectId_key`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_shots` (
    `id` VARCHAR(191) NOT NULL,
    `episodeId` VARCHAR(191) NOT NULL,
    `clipId` VARCHAR(191) NULL,
    `shotId` VARCHAR(191) NOT NULL,
    `srtStart` INTEGER NOT NULL,
    `srtEnd` INTEGER NOT NULL,
    `srtDuration` DOUBLE NOT NULL,
    `sequence` TEXT NULL,
    `locations` TEXT NULL,
    `characters` TEXT NULL,
    `plot` TEXT NULL,
    `imagePrompt` TEXT NULL,
    `scale` TEXT NULL,
    `module` TEXT NULL,
    `focus` TEXT NULL,
    `zhSummarize` TEXT NULL,
    `imageUrl` TEXT NULL,
    `imageMediaId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `pov` TEXT NULL,

    INDEX `novel_promotion_shots_clipId_idx`(`clipId`),
    INDEX `novel_promotion_shots_episodeId_idx`(`episodeId`),
    INDEX `novel_promotion_shots_shotId_idx`(`shotId`),
    INDEX `novel_promotion_shots_imageMediaId_idx`(`imageMediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_storyboards` (
    `id` VARCHAR(191) NOT NULL,
    `episodeId` VARCHAR(191) NOT NULL,
    `clipId` VARCHAR(191) NOT NULL,
    `storyboardImageUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `panelCount` INTEGER NOT NULL DEFAULT 9,
    `storyboardTextJson` TEXT NULL,
    `imageHistory` TEXT NULL,
    `candidateImages` TEXT NULL,
    `lastError` VARCHAR(191) NULL,
    `photographyPlan` TEXT NULL,

    UNIQUE INDEX `novel_promotion_storyboards_clipId_key`(`clipId`),
    INDEX `novel_promotion_storyboards_clipId_idx`(`clipId`),
    INDEX `novel_promotion_storyboards_episodeId_idx`(`episodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplementary_panels` (
    `id` VARCHAR(191) NOT NULL,
    `storyboardId` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourcePanelId` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `imagePrompt` TEXT NULL,
    `imageUrl` TEXT NULL,
    `imageMediaId` VARCHAR(191) NULL,
    `characters` TEXT NULL,
    `location` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supplementary_panels_storyboardId_idx`(`storyboardId`),
    INDEX `supplementary_panels_imageMediaId_idx`(`imageMediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `projectType` VARCHAR(191) NOT NULL DEFAULT 'novel-promotion',
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastAccessedAt` DATETIME(3) NULL,
    `resolution` VARCHAR(191) NULL,
    `frameRate` VARCHAR(191) NULL,
    `colorSpace` VARCHAR(191) NULL,

    INDEX `projects_userId_idx`(`userId`),
    INDEX `projects_projectType_idx`(`projectType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sequences` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'not_started',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sequences_projectId_idx`(`projectId`),
    UNIQUE INDEX `sequences_projectId_code_key`(`projectId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cg_shots` (
    `id` VARCHAR(191) NOT NULL,
    `sequenceId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'not_started',
    `frameIn` INTEGER NULL,
    `frameOut` INTEGER NULL,
    `duration` INTEGER NULL,
    `thumbnailUrl` TEXT NULL,
    `thumbnailMediaId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cg_shots_sequenceId_idx`(`sequenceId`),
    INDEX `cg_shots_thumbnailMediaId_idx`(`thumbnailMediaId`),
    UNIQUE INDEX `cg_shots_sequenceId_code_key`(`sequenceId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cg_assets` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `assetType` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'not_started',
    `thumbnailUrl` TEXT NULL,
    `thumbnailMediaId` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cg_assets_projectId_idx`(`projectId`),
    INDEX `cg_assets_assetType_idx`(`assetType`),
    INDEX `cg_assets_thumbnailMediaId_idx`(`thumbnailMediaId`),
    UNIQUE INDEX `cg_assets_projectId_code_key`(`projectId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_variations` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_variations_assetId_idx`(`assetId`),
    UNIQUE INDEX `asset_variations_assetId_code_key`(`assetId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pipeline_steps` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NOT NULL DEFAULT 'shot',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pipeline_steps_projectId_idx`(`projectId`),
    UNIQUE INDEX `pipeline_steps_projectId_code_key`(`projectId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `pipelineStepId` VARCHAR(191) NOT NULL,
    `shotId` VARCHAR(191) NULL,
    `assetId` VARCHAR(191) NULL,
    `assigneeId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'not_started',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `bidDays` DOUBLE NULL,
    `actualDays` DOUBLE NULL,
    `startDate` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `production_tasks_pipelineStepId_idx`(`pipelineStepId`),
    INDEX `production_tasks_shotId_idx`(`shotId`),
    INDEX `production_tasks_assetId_idx`(`assetId`),
    INDEX `production_tasks_assigneeId_idx`(`assigneeId`),
    INDEX `production_tasks_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_dependencies` (
    `id` VARCHAR(191) NOT NULL,
    `dependentTaskId` VARCHAR(191) NOT NULL,
    `prerequisiteTaskId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'FS',
    `lagDays` DOUBLE NOT NULL DEFAULT 0,

    INDEX `task_dependencies_prerequisiteTaskId_idx`(`prerequisiteTaskId`),
    UNIQUE INDEX `task_dependencies_dependentTaskId_prerequisiteTaskId_key`(`dependentTaskId`, `prerequisiteTaskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cg_versions` (
    `id` VARCHAR(191) NOT NULL,
    `productionTaskId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending_review',
    `filePath` TEXT NULL,
    `mediaPath` TEXT NULL,
    `mediaId` VARCHAR(191) NULL,
    `thumbnailUrl` TEXT NULL,
    `metadata` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cg_versions_productionTaskId_idx`(`productionTaskId`),
    INDEX `cg_versions_createdById_idx`(`createdById`),
    INDEX `cg_versions_mediaId_idx`(`mediaId`),
    UNIQUE INDEX `cg_versions_productionTaskId_versionNumber_key`(`productionTaskId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cg_publishes` (
    `id` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `publishType` VARCHAR(191) NOT NULL,
    `filePath` TEXT NOT NULL,
    `fileHash` VARCHAR(191) NULL,
    `fileSize` BIGINT NULL,
    `isLocked` BOOLEAN NOT NULL DEFAULT true,
    `metadata` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cg_publishes_versionId_idx`(`versionId`),
    INDEX `cg_publishes_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publish_dependencies` (
    `id` VARCHAR(191) NOT NULL,
    `publishId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,

    INDEX `publish_dependencies_assetId_idx`(`assetId`),
    UNIQUE INDEX `publish_dependencies_publishId_assetId_key`(`publishId`, `assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cg_notes` (
    `id` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `shotId` VARCHAR(191) NULL,
    `assetId` VARCHAR(191) NULL,
    `productionTaskId` VARCHAR(191) NULL,
    `versionId` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `annotations` TEXT NULL,
    `frameNumber` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cg_notes_authorId_idx`(`authorId`),
    INDEX `cg_notes_shotId_idx`(`shotId`),
    INDEX `cg_notes_assetId_idx`(`assetId`),
    INDEX `cg_notes_productionTaskId_idx`(`productionTaskId`),
    INDEX `cg_notes_versionId_idx`(`versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playlists` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `playlists_projectId_idx`(`projectId`),
    INDEX `playlists_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playlist_items` (
    `id` VARCHAR(191) NOT NULL,
    `playlistId` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `playlist_items_playlistId_idx`(`playlistId`),
    INDEX `playlist_items_versionId_idx`(`versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `naming_templates` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `pattern` VARCHAR(191) NOT NULL,
    `example` VARCHAR(191) NULL,

    UNIQUE INDEX `naming_templates_projectId_entityType_key`(`projectId`, `entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_triggers` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `conditions` TEXT NULL,
    `actions` TEXT NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_triggers_projectId_idx`(`projectId`),
    INDEX `event_triggers_eventType_idx`(`eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_shares` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `shareCode` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `project_shares_shareCode_key`(`shareCode`),
    INDEX `project_shares_projectId_idx`(`projectId`),
    INDEX `project_shares_shareCode_idx`(`shareCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    INDEX `session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usage_costs` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `apiType` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `cost` DECIMAL(18, 6) NOT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `usage_costs_apiType_idx`(`apiType`),
    INDEX `usage_costs_createdAt_idx`(`createdAt`),
    INDEX `usage_costs_projectId_idx`(`projectId`),
    INDEX `usage_costs_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `image` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `systemRole` VARCHAR(191) NOT NULL DEFAULT 'artist',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `analysisModel` VARCHAR(191) NULL,
    `characterModel` VARCHAR(191) NULL,
    `locationModel` VARCHAR(191) NULL,
    `storyboardModel` VARCHAR(191) NULL,
    `editModel` VARCHAR(191) NULL,
    `videoModel` VARCHAR(191) NULL,
    `lipSyncModel` VARCHAR(191) NULL,
    `videoRatio` VARCHAR(191) NOT NULL DEFAULT '9:16',
    `videoResolution` VARCHAR(191) NOT NULL DEFAULT '720p',
    `artStyle` VARCHAR(191) NOT NULL DEFAULT 'american-comic',
    `ttsRate` VARCHAR(191) NOT NULL DEFAULT '+50%',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `imageResolution` VARCHAR(191) NOT NULL DEFAULT '2K',
    `capabilityDefaults` TEXT NULL,
    `llmBaseUrl` VARCHAR(191) NULL DEFAULT 'https://openrouter.ai/api/v1',
    `llmApiKey` TEXT NULL,
    `falApiKey` TEXT NULL,
    `googleAiKey` TEXT NULL,
    `arkApiKey` TEXT NULL,
    `qwenApiKey` TEXT NULL,
    `customModels` TEXT NULL,
    `customProviders` TEXT NULL,

    UNIQUE INDEX `user_preferences_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verificationtoken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `verificationtoken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `novel_promotion_voice_lines` (
    `id` VARCHAR(191) NOT NULL,
    `episodeId` VARCHAR(191) NOT NULL,
    `lineIndex` INTEGER NOT NULL,
    `speaker` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `voicePresetId` VARCHAR(191) NULL,
    `audioUrl` TEXT NULL,
    `audioMediaId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `emotionPrompt` TEXT NULL,
    `emotionStrength` DOUBLE NULL DEFAULT 0.4,
    `matchedPanelIndex` INTEGER NULL,
    `matchedStoryboardId` VARCHAR(191) NULL,
    `audioDuration` INTEGER NULL,
    `matchedPanelId` VARCHAR(191) NULL,

    INDEX `novel_promotion_voice_lines_episodeId_idx`(`episodeId`),
    INDEX `novel_promotion_voice_lines_matchedPanelId_idx`(`matchedPanelId`),
    INDEX `novel_promotion_voice_lines_audioMediaId_idx`(`audioMediaId`),
    UNIQUE INDEX `novel_promotion_voice_lines_episodeId_lineIndex_key`(`episodeId`, `lineIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_presets` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `audioUrl` TEXT NOT NULL,
    `audioMediaId` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `gender` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `voice_presets_audioMediaId_idx`(`audioMediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_balances` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `frozenAmount` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `totalSpent` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_balances_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `balance_freezes` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 6) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `source` VARCHAR(64) NULL,
    `taskId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `balance_freezes_idempotencyKey_key`(`idempotencyKey`),
    INDEX `balance_freezes_userId_idx`(`userId`),
    INDEX `balance_freezes_status_idx`(`status`),
    INDEX `balance_freezes_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `balance_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 6) NOT NULL,
    `balanceAfter` DECIMAL(18, 6) NOT NULL,
    `description` TEXT NULL,
    `relatedId` VARCHAR(191) NULL,
    `freezeId` VARCHAR(191) NULL,
    `operatorId` VARCHAR(64) NULL,
    `externalOrderId` VARCHAR(128) NULL,
    `idempotencyKey` VARCHAR(128) NULL,
    `projectId` VARCHAR(128) NULL,
    `episodeId` VARCHAR(128) NULL,
    `taskType` VARCHAR(64) NULL,
    `billingMeta` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `balance_transactions_userId_idx`(`userId`),
    INDEX `balance_transactions_type_idx`(`type`),
    INDEX `balance_transactions_createdAt_idx`(`createdAt`),
    INDEX `balance_transactions_freezeId_idx`(`freezeId`),
    INDEX `balance_transactions_externalOrderId_idx`(`externalOrderId`),
    INDEX `balance_transactions_projectId_idx`(`projectId`),
    UNIQUE INDEX `balance_transactions_userId_type_idempotencyKey_key`(`userId`, `type`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `episodeId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `attempt` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `dedupeKey` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `result` JSON NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `billingInfo` JSON NULL,
    `billedAt` DATETIME(3) NULL,
    `queuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `heartbeatAt` DATETIME(3) NULL,
    `enqueuedAt` DATETIME(3) NULL,
    `enqueueAttempts` INTEGER NOT NULL DEFAULT 0,
    `lastEnqueueError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tasks_dedupeKey_key`(`dedupeKey`),
    INDEX `tasks_status_idx`(`status`),
    INDEX `tasks_type_idx`(`type`),
    INDEX `tasks_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `tasks_projectId_idx`(`projectId`),
    INDEX `tasks_userId_idx`(`userId`),
    INDEX `tasks_heartbeatAt_idx`(`heartbeatAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_events_projectId_id_idx`(`projectId`, `id`),
    INDEX `task_events_taskId_idx`(`taskId`),
    INDEX `task_events_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_asset_folders` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `global_asset_folders_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_characters` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `folderId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `aliases` TEXT NULL,
    `profileData` TEXT NULL,
    `profileConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `voiceId` VARCHAR(191) NULL,
    `voiceType` VARCHAR(191) NULL,
    `customVoiceUrl` TEXT NULL,
    `customVoiceMediaId` VARCHAR(191) NULL,
    `globalVoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `global_characters_userId_idx`(`userId`),
    INDEX `global_characters_folderId_idx`(`folderId`),
    INDEX `global_characters_customVoiceMediaId_idx`(`customVoiceMediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_character_appearances` (
    `id` VARCHAR(191) NOT NULL,
    `characterId` VARCHAR(191) NOT NULL,
    `appearanceIndex` INTEGER NOT NULL,
    `changeReason` VARCHAR(191) NOT NULL DEFAULT 'default',
    `description` TEXT NULL,
    `descriptions` TEXT NULL,
    `imageUrl` TEXT NULL,
    `imageMediaId` VARCHAR(191) NULL,
    `imageUrls` TEXT NULL,
    `selectedIndex` INTEGER NULL,
    `previousImageUrl` TEXT NULL,
    `previousImageMediaId` VARCHAR(191) NULL,
    `previousImageUrls` TEXT NULL,
    `previousDescription` TEXT NULL,
    `previousDescriptions` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `global_character_appearances_characterId_idx`(`characterId`),
    INDEX `global_character_appearances_imageMediaId_idx`(`imageMediaId`),
    INDEX `global_character_appearances_previousImageMediaId_idx`(`previousImageMediaId`),
    UNIQUE INDEX `global_character_appearances_characterId_appearanceIndex_key`(`characterId`, `appearanceIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_locations` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `folderId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `global_locations_userId_idx`(`userId`),
    INDEX `global_locations_folderId_idx`(`folderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_location_images` (
    `id` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `imageIndex` INTEGER NOT NULL,
    `description` TEXT NULL,
    `imageUrl` TEXT NULL,
    `imageMediaId` VARCHAR(191) NULL,
    `isSelected` BOOLEAN NOT NULL DEFAULT false,
    `previousImageUrl` TEXT NULL,
    `previousImageMediaId` VARCHAR(191) NULL,
    `previousDescription` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `global_location_images_locationId_idx`(`locationId`),
    INDEX `global_location_images_imageMediaId_idx`(`imageMediaId`),
    INDEX `global_location_images_previousImageMediaId_idx`(`previousImageMediaId`),
    UNIQUE INDEX `global_location_images_locationId_imageIndex_key`(`locationId`, `imageIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_voices` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `folderId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `voiceId` VARCHAR(191) NULL,
    `voiceType` VARCHAR(191) NOT NULL DEFAULT 'qwen-designed',
    `customVoiceUrl` TEXT NULL,
    `customVoiceMediaId` VARCHAR(191) NULL,
    `voicePrompt` TEXT NULL,
    `gender` VARCHAR(191) NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'zh',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `global_voices_userId_idx`(`userId`),
    INDEX `global_voices_folderId_idx`(`folderId`),
    INDEX `global_voices_customVoiceMediaId_idx`(`customVoiceMediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_objects` (
    `id` VARCHAR(191) NOT NULL,
    `publicId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(512) NOT NULL,
    `sha256` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `sizeBytes` BIGINT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `durationMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `media_objects_publicId_key`(`publicId`),
    UNIQUE INDEX `media_objects_storageKey_key`(`storageKey`),
    INDEX `media_objects_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_members` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'editor',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_members_projectId_idx`(`projectId`),
    INDEX `project_members_userId_idx`(`userId`),
    UNIQUE INDEX `project_members_projectId_userId_key`(`projectId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_channels` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'project',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_channels_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'text',
    `mentions` TEXT NULL,
    `replyToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_messages_channelId_createdAt_idx`(`channelId`, `createdAt`),
    INDEX `chat_messages_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_read_states` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `lastReadMessageId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `message_read_states_channelId_idx`(`channelId`),
    UNIQUE INDEX `message_read_states_userId_channelId_key`(`userId`, `channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_projectId_idx`(`projectId`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `legacy_media_refs_backup` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `tableName` VARCHAR(191) NOT NULL,
    `rowId` VARCHAR(191) NOT NULL,
    `fieldName` VARCHAR(191) NOT NULL,
    `legacyValue` TEXT NOT NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `legacy_media_refs_backup_runId_idx`(`runId`),
    INDEX `legacy_media_refs_backup_tableName_fieldName_idx`(`tableName`, `fieldName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `account` ADD CONSTRAINT `account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `character_appearances` ADD CONSTRAINT `character_appearances_imageMediaId_fkey` FOREIGN KEY (`imageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `character_appearances` ADD CONSTRAINT `character_appearances_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `novel_promotion_characters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_images` ADD CONSTRAINT `location_images_imageMediaId_fkey` FOREIGN KEY (`imageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_images` ADD CONSTRAINT `location_images_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `novel_promotion_locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_characters` ADD CONSTRAINT `novel_promotion_characters_customVoiceMediaId_fkey` FOREIGN KEY (`customVoiceMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_characters` ADD CONSTRAINT `novel_promotion_characters_novelPromotionProjectId_fkey` FOREIGN KEY (`novelPromotionProjectId`) REFERENCES `novel_promotion_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_locations` ADD CONSTRAINT `novel_promotion_locations_selectedImageId_fkey` FOREIGN KEY (`selectedImageId`) REFERENCES `location_images`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_locations` ADD CONSTRAINT `novel_promotion_locations_novelPromotionProjectId_fkey` FOREIGN KEY (`novelPromotionProjectId`) REFERENCES `novel_promotion_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_episodes` ADD CONSTRAINT `novel_promotion_episodes_audioMediaId_fkey` FOREIGN KEY (`audioMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_episodes` ADD CONSTRAINT `novel_promotion_episodes_novelPromotionProjectId_fkey` FOREIGN KEY (`novelPromotionProjectId`) REFERENCES `novel_promotion_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_editor_projects` ADD CONSTRAINT `video_editor_projects_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `novel_promotion_episodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_clips` ADD CONSTRAINT `novel_promotion_clips_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `novel_promotion_episodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_panels` ADD CONSTRAINT `novel_promotion_panels_imageMediaId_fkey` FOREIGN KEY (`imageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_panels` ADD CONSTRAINT `novel_promotion_panels_videoMediaId_fkey` FOREIGN KEY (`videoMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_panels` ADD CONSTRAINT `novel_promotion_panels_lipSyncVideoMediaId_fkey` FOREIGN KEY (`lipSyncVideoMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_panels` ADD CONSTRAINT `novel_promotion_panels_sketchImageMediaId_fkey` FOREIGN KEY (`sketchImageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_panels` ADD CONSTRAINT `novel_promotion_panels_previousImageMediaId_fkey` FOREIGN KEY (`previousImageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_panels` ADD CONSTRAINT `novel_promotion_panels_storyboardId_fkey` FOREIGN KEY (`storyboardId`) REFERENCES `novel_promotion_storyboards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_projects` ADD CONSTRAINT `novel_promotion_projects_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_shots` ADD CONSTRAINT `novel_promotion_shots_imageMediaId_fkey` FOREIGN KEY (`imageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_shots` ADD CONSTRAINT `novel_promotion_shots_clipId_fkey` FOREIGN KEY (`clipId`) REFERENCES `novel_promotion_clips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_shots` ADD CONSTRAINT `novel_promotion_shots_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `novel_promotion_episodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_storyboards` ADD CONSTRAINT `novel_promotion_storyboards_clipId_fkey` FOREIGN KEY (`clipId`) REFERENCES `novel_promotion_clips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_storyboards` ADD CONSTRAINT `novel_promotion_storyboards_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `novel_promotion_episodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplementary_panels` ADD CONSTRAINT `supplementary_panels_imageMediaId_fkey` FOREIGN KEY (`imageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplementary_panels` ADD CONSTRAINT `supplementary_panels_storyboardId_fkey` FOREIGN KEY (`storyboardId`) REFERENCES `novel_promotion_storyboards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sequences` ADD CONSTRAINT `sequences_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_shots` ADD CONSTRAINT `cg_shots_thumbnailMediaId_fkey` FOREIGN KEY (`thumbnailMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_shots` ADD CONSTRAINT `cg_shots_sequenceId_fkey` FOREIGN KEY (`sequenceId`) REFERENCES `sequences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_assets` ADD CONSTRAINT `cg_assets_thumbnailMediaId_fkey` FOREIGN KEY (`thumbnailMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_assets` ADD CONSTRAINT `cg_assets_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_variations` ADD CONSTRAINT `asset_variations_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `cg_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pipeline_steps` ADD CONSTRAINT `pipeline_steps_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_tasks` ADD CONSTRAINT `production_tasks_pipelineStepId_fkey` FOREIGN KEY (`pipelineStepId`) REFERENCES `pipeline_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_tasks` ADD CONSTRAINT `production_tasks_shotId_fkey` FOREIGN KEY (`shotId`) REFERENCES `cg_shots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_tasks` ADD CONSTRAINT `production_tasks_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `cg_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_tasks` ADD CONSTRAINT `production_tasks_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependencies` ADD CONSTRAINT `task_dependencies_dependentTaskId_fkey` FOREIGN KEY (`dependentTaskId`) REFERENCES `production_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependencies` ADD CONSTRAINT `task_dependencies_prerequisiteTaskId_fkey` FOREIGN KEY (`prerequisiteTaskId`) REFERENCES `production_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_versions` ADD CONSTRAINT `cg_versions_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_versions` ADD CONSTRAINT `cg_versions_productionTaskId_fkey` FOREIGN KEY (`productionTaskId`) REFERENCES `production_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_versions` ADD CONSTRAINT `cg_versions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_publishes` ADD CONSTRAINT `cg_publishes_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `cg_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_publishes` ADD CONSTRAINT `cg_publishes_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publish_dependencies` ADD CONSTRAINT `publish_dependencies_publishId_fkey` FOREIGN KEY (`publishId`) REFERENCES `cg_publishes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publish_dependencies` ADD CONSTRAINT `publish_dependencies_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `cg_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_notes` ADD CONSTRAINT `cg_notes_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_notes` ADD CONSTRAINT `cg_notes_shotId_fkey` FOREIGN KEY (`shotId`) REFERENCES `cg_shots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_notes` ADD CONSTRAINT `cg_notes_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `cg_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_notes` ADD CONSTRAINT `cg_notes_productionTaskId_fkey` FOREIGN KEY (`productionTaskId`) REFERENCES `production_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cg_notes` ADD CONSTRAINT `cg_notes_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `cg_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playlists` ADD CONSTRAINT `playlists_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playlists` ADD CONSTRAINT `playlists_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playlist_items` ADD CONSTRAINT `playlist_items_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `playlists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playlist_items` ADD CONSTRAINT `playlist_items_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `cg_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `naming_templates` ADD CONSTRAINT `naming_templates_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_triggers` ADD CONSTRAINT `event_triggers_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_shares` ADD CONSTRAINT `project_shares_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_costs` ADD CONSTRAINT `usage_costs_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_costs` ADD CONSTRAINT `usage_costs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_voice_lines` ADD CONSTRAINT `novel_promotion_voice_lines_audioMediaId_fkey` FOREIGN KEY (`audioMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_voice_lines` ADD CONSTRAINT `novel_promotion_voice_lines_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `novel_promotion_episodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `novel_promotion_voice_lines` ADD CONSTRAINT `novel_promotion_voice_lines_matchedPanelId_fkey` FOREIGN KEY (`matchedPanelId`) REFERENCES `novel_promotion_panels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_presets` ADD CONSTRAINT `voice_presets_audioMediaId_fkey` FOREIGN KEY (`audioMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_balances` ADD CONSTRAINT `user_balances_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `balance_freezes` ADD CONSTRAINT `balance_freezes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `balance_transactions` ADD CONSTRAINT `balance_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `balance_transactions` ADD CONSTRAINT `balance_transactions_freezeId_fkey` FOREIGN KEY (`freezeId`) REFERENCES `balance_freezes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_events` ADD CONSTRAINT `task_events_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_events` ADD CONSTRAINT `task_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_events` ADD CONSTRAINT `task_events_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_asset_folders` ADD CONSTRAINT `global_asset_folders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_characters` ADD CONSTRAINT `global_characters_customVoiceMediaId_fkey` FOREIGN KEY (`customVoiceMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_characters` ADD CONSTRAINT `global_characters_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_characters` ADD CONSTRAINT `global_characters_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `global_asset_folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_character_appearances` ADD CONSTRAINT `global_character_appearances_imageMediaId_fkey` FOREIGN KEY (`imageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_character_appearances` ADD CONSTRAINT `global_character_appearances_previousImageMediaId_fkey` FOREIGN KEY (`previousImageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_character_appearances` ADD CONSTRAINT `global_character_appearances_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `global_characters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_locations` ADD CONSTRAINT `global_locations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_locations` ADD CONSTRAINT `global_locations_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `global_asset_folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_location_images` ADD CONSTRAINT `global_location_images_imageMediaId_fkey` FOREIGN KEY (`imageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_location_images` ADD CONSTRAINT `global_location_images_previousImageMediaId_fkey` FOREIGN KEY (`previousImageMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_location_images` ADD CONSTRAINT `global_location_images_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `global_locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_voices` ADD CONSTRAINT `global_voices_customVoiceMediaId_fkey` FOREIGN KEY (`customVoiceMediaId`) REFERENCES `media_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_voices` ADD CONSTRAINT `global_voices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_voices` ADD CONSTRAINT `global_voices_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `global_asset_folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_channels` ADD CONSTRAINT `chat_channels_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `chat_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_replyToId_fkey` FOREIGN KEY (`replyToId`) REFERENCES `chat_messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_read_states` ADD CONSTRAINT `message_read_states_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_read_states` ADD CONSTRAINT `message_read_states_lastReadMessageId_fkey` FOREIGN KEY (`lastReadMessageId`) REFERENCES `chat_messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
