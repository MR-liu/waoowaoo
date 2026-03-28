# AI Film Studio UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the workspace experience into a storyboard-centered AI film studio system with unified light/dark design tokens, a control-room workspace home, a focused project production shell, and an asset mother-library surface.

**Architecture:** Keep the existing App Router route tree and novel-promotion stage tree, but replace the current “glass page + large page component” composition with a studio shell architecture. Extend the existing token files instead of creating a second design system, extract pure view-model helpers for page priority decisions, and use those helpers as the main test seam because the current Vitest setup is `node`-only and does not include a DOM rendering harness.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Framer Motion, next-intl, Vitest

---

## Scope Check

This spec spans four coupled workstreams:

1. Unified studio tokens and motion
2. Workspace home (`/workspace`)
3. Project production shell (`/workspace/[projectId]`)
4. Asset hub (`/workspace/asset-hub`)

They share one visual system and one navigation philosophy, so a single implementation plan is acceptable, but each task below is designed as an independently testable milestone.

**Repo constraint override:** This repository forbids planning git state changes unless the user explicitly asks. Therefore this plan intentionally omits commit steps even though the default writing-plans skill normally includes them.

## File Structure

### Existing files to modify

- Modify: `src/app/globals.css`
- Modify: `src/styles/ui-tokens-glass.css`
- Modify: `src/styles/ui-semantic-glass.css`
- Modify: `src/styles/motion-tokens.css`
- Modify: `src/lib/ui/motion.ts`
- Modify: `src/app/[locale]/workspace/page.tsx`
- Modify: `src/app/[locale]/workspace/components/ProducerDashboard.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/page.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/NovelPromotionWorkspace.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/StageNavigation.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/WorkspaceHeaderShell.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/WorkspaceStageContent.tsx`
- Modify: `src/app/[locale]/workspace/asset-hub/page.tsx`
- Modify: `src/app/[locale]/workspace/asset-hub/components/AssetGrid.tsx`
- Modify: `src/app/[locale]/workspace/asset-hub/components/FolderSidebar.tsx`

### New files to create

- Create: `src/lib/ui/studio-surface.ts`
- Create: `src/lib/ui/workspace-home-view-model.ts`
- Create: `src/lib/ui/project-workspace-view-model.ts`
- Create: `src/lib/ui/asset-hub-view-model.ts`
- Create: `src/app/[locale]/workspace/components/WorkspaceOverviewStrip.tsx`
- Create: `src/app/[locale]/workspace/components/WorkspaceContinuePanel.tsx`
- Create: `src/app/[locale]/workspace/components/WorkspaceProjectSection.tsx`
- Create: `src/app/[locale]/workspace/[projectId]/components/ProjectStudioShell.tsx`
- Create: `src/app/[locale]/workspace/[projectId]/components/ProjectControlBar.tsx`
- Create: `src/app/[locale]/workspace/[projectId]/components/ProjectResultRail.tsx`
- Create: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/StoryboardHeroPanel.tsx`
- Create: `src/app/[locale]/workspace/asset-hub/components/AssetHubSummaryStrip.tsx`
- Create: `src/app/[locale]/workspace/asset-hub/components/AssetHubTypeTabs.tsx`
- Create: `src/app/[locale]/workspace/asset-hub/components/AssetHubDetailPanel.tsx`
- Create: `tests/unit/workspace/studio-surface.test.ts`
- Create: `tests/unit/workspace/workspace-home-view-model.test.ts`
- Create: `tests/unit/workspace/project-workspace-view-model.test.ts`
- Create: `tests/unit/workspace/asset-hub-view-model.test.ts`
- Create: `tests/unit/workspace/motion-presets.test.ts`

### Responsibility map

- `src/lib/ui/studio-surface.ts`: source of truth for light / adaptive / dark surface selection by page or stage
- `src/lib/ui/workspace-home-view-model.ts`: computes workspace-home priority cards, summary strip, continue-work ordering
- `src/lib/ui/project-workspace-view-model.ts`: computes project shell emphasis, hero stage meta, primary CTA, result rail priority
- `src/lib/ui/asset-hub-view-model.ts`: computes asset hub summary metrics, type counts, pinned detail state
- `WorkspaceOverviewStrip` / `WorkspaceContinuePanel` / `WorkspaceProjectSection`: split current 699-line workspace page into focused layout units
- `ProjectStudioShell` / `ProjectControlBar` / `ProjectResultRail` / `StoryboardHeroPanel`: implement the storyboard-centered project shell without rewriting every stage component
- `AssetHubSummaryStrip` / `AssetHubTypeTabs` / `AssetHubDetailPanel`: turn asset hub from a generic grid page into a reusable asset management surface

## Task 1: Establish Studio Tokens, Surface Modes, and Motion Defaults

**Files:**
- Modify: `src/styles/ui-tokens-glass.css`
- Modify: `src/styles/ui-semantic-glass.css`
- Modify: `src/styles/motion-tokens.css`
- Modify: `src/app/globals.css`
- Modify: `src/lib/ui/motion.ts`
- Create: `src/lib/ui/studio-surface.ts`
- Test: `tests/unit/workspace/studio-surface.test.ts`
- Test: `tests/unit/workspace/motion-presets.test.ts`

- [ ] **Step 1: Write the failing surface-mode tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  resolveWorkspaceSurface,
  resolveProjectStageSurface,
  STUDIO_SURFACE_CLASSNAMES,
} from '@/lib/ui/studio-surface'

describe('studio surface routing', () => {
  it('workspace home -> light control-room surface', () => {
    expect(resolveWorkspaceSurface('/workspace')).toBe('light')
    expect(STUDIO_SURFACE_CLASSNAMES.light).toContain('studio-surface-light')
  })

  it('asset hub -> adaptive transition surface', () => {
    expect(resolveWorkspaceSurface('/workspace/asset-hub')).toBe('adaptive')
  })

  it('storyboard and assets stages -> adaptive production surface', () => {
    expect(resolveProjectStageSurface('storyboard')).toBe('adaptive')
    expect(resolveProjectStageSurface('assets')).toBe('adaptive')
  })

  it('videos, voice, editor stages -> dark creation surface', () => {
    expect(resolveProjectStageSurface('videos')).toBe('dark')
    expect(resolveProjectStageSurface('voice')).toBe('dark')
    expect(resolveProjectStageSurface('editor')).toBe('dark')
  })
})
```

```ts
import { describe, expect, it } from 'vitest'
import { MOTION_PRESETS } from '@/lib/ui/motion'

describe('studio motion presets', () => {
  it('uses non-spring control-room timings for hover and press', () => {
    expect(MOTION_PRESETS.hover.scale).toBe(1.01)
    expect(MOTION_PRESETS.press.scale).toBe(0.99)
  })

  it('uses control-room easing for modal transitions', () => {
    expect(MOTION_PRESETS.modal.duration).toBe(0.24)
    expect(MOTION_PRESETS.modal.ease).toEqual([0.22, 1, 0.36, 1])
  })
})
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/studio-surface.test.ts tests/unit/workspace/motion-presets.test.ts
```

Expected:

```text
FAIL  tests/unit/workspace/studio-surface.test.ts
FAIL  tests/unit/workspace/motion-presets.test.ts
Error: Cannot find module '@/lib/ui/studio-surface'
```

- [ ] **Step 3: Implement surface-mode helpers and extend the design tokens**

Create `src/lib/ui/studio-surface.ts`:

```ts
export type StudioSurface = 'light' | 'adaptive' | 'dark'

const DARK_STAGES = new Set(['videos', 'voice', 'editor'])
const ADAPTIVE_STAGES = new Set(['assets', 'storyboard'])

export const STUDIO_SURFACE_CLASSNAMES: Record<StudioSurface, string> = {
  light: 'studio-surface-light',
  adaptive: 'studio-surface-adaptive',
  dark: 'studio-surface-dark',
}

export function resolveWorkspaceSurface(pathname: string): StudioSurface {
  if (pathname.includes('/workspace/asset-hub')) return 'adaptive'
  return 'light'
}

export function resolveProjectStageSurface(stage: string): StudioSurface {
  if (DARK_STAGES.has(stage)) return 'dark'
  if (ADAPTIVE_STAGES.has(stage)) return 'adaptive'
  return 'light'
}
```

Update `src/styles/ui-tokens-glass.css` by replacing the fixed light-only tokens with a studio-aware token structure:

```css
:root {
  --studio-primary: #5e8bff;
  --studio-primary-deep: #3e63dd;
  --studio-accent-cyan: #79c9ff;

  --glass-bg-canvas: #edf2f7;
  --glass-bg-surface: rgba(255, 255, 255, 0.68);
  --glass-bg-surface-strong: rgba(255, 255, 255, 0.82);
  --glass-text-primary: #0f172a;
  --glass-text-secondary: #334155;
  --glass-text-tertiary: #64748b;
  --glass-stroke-base: rgba(122, 138, 158, 0.18);
}

.studio-surface-dark {
  --glass-bg-canvas: #12171d;
  --glass-bg-surface: rgba(21, 28, 36, 0.88);
  --glass-bg-surface-strong: rgba(27, 35, 45, 0.96);
  --glass-text-primary: #f3f7fb;
  --glass-text-secondary: #c7d2e0;
  --glass-text-tertiary: #8a97a8;
  --glass-stroke-base: rgba(154, 170, 192, 0.14);
}

.studio-surface-adaptive {
  color-scheme: light dark;
}
```

Update `src/styles/motion-tokens.css` and `src/lib/ui/motion.ts` to use the approved durations and bezier curves:

```css
:root {
  --motion-duration-fast: 140ms;
  --motion-duration-base: 220ms;
  --motion-duration-slow: 320ms;
  --motion-ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --motion-ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
}
```

```ts
export const MOTION_PRESETS = {
  hover: { scale: 1.01 },
  press: { scale: 0.99 },
  modal: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
  pageEnter: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
} as const
```

- [ ] **Step 4: Wire the global stylesheet to the new studio shell primitives**

Update `src/app/globals.css` and `src/styles/ui-semantic-glass.css`:

```css
body {
  background: var(--glass-bg-canvas);
  color: var(--glass-text-primary);
  font-family: var(--font-body), var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

.studio-shell {
  width: min(1680px, calc(100% - 32px));
  margin: 0 auto;
}

.studio-surface-light,
.studio-surface-adaptive,
.studio-surface-dark {
  min-height: 100%;
  background: var(--glass-bg-canvas);
  color: var(--glass-text-primary);
}

.studio-panel {
  border: 1px solid var(--glass-stroke-base);
  border-radius: 20px;
  background: var(--glass-bg-surface);
}
```

- [ ] **Step 5: Run targeted tests and lint on the theme foundation**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/studio-surface.test.ts tests/unit/workspace/motion-presets.test.ts
npx eslint src/lib/ui/studio-surface.ts src/lib/ui/motion.ts src/app/globals.css src/styles/ui-tokens-glass.css src/styles/ui-semantic-glass.css src/styles/motion-tokens.css
```

Expected:

```text
2 passed
0 problems
```

## Task 2: Rebuild `/workspace` into a Control-Room Home

**Files:**
- Modify: `src/app/[locale]/workspace/page.tsx`
- Modify: `src/app/[locale]/workspace/components/ProducerDashboard.tsx`
- Create: `src/lib/ui/workspace-home-view-model.ts`
- Create: `src/app/[locale]/workspace/components/WorkspaceOverviewStrip.tsx`
- Create: `src/app/[locale]/workspace/components/WorkspaceContinuePanel.tsx`
- Create: `src/app/[locale]/workspace/components/WorkspaceProjectSection.tsx`
- Test: `tests/unit/workspace/workspace-home-view-model.test.ts`

- [ ] **Step 1: Write failing tests for workspace-home priority ordering**

```ts
import { describe, expect, it } from 'vitest'
import { buildWorkspaceHomeViewModel } from '@/lib/ui/workspace-home-view-model'

describe('buildWorkspaceHomeViewModel', () => {
  it('puts failed items ahead of recent completions and recent projects', () => {
    const vm = buildWorkspaceHomeViewModel({
      projects: [
        { id: 'p-1', name: 'A', updatedAt: '2026-03-29T10:00:00.000Z', totalCost: 2 },
      ],
      dashboardData: {
        reviewQueue: [],
        assignedTasks: [
          { id: 't-1', projectId: 'p-1', projectName: 'A', shotCode: 'S1', assetCode: null, stepName: 'storyboard', status: 'failed', dueDate: null },
        ],
      },
    })

    expect(vm.continueCards[0]).toMatchObject({
      kind: 'failed-task',
      projectId: 'p-1',
      title: 'A',
      stage: 'storyboard',
    })
  })

  it('computes summary counters from project and task inputs', () => {
    const vm = buildWorkspaceHomeViewModel({
      projects: [
        { id: 'p-1', name: 'A', updatedAt: '2026-03-29T10:00:00.000Z', totalCost: 2 },
        { id: 'p-2', name: 'B', updatedAt: '2026-03-29T10:05:00.000Z', totalCost: 8 },
      ],
      dashboardData: {
        reviewQueue: [{ id: 'r-1' }],
        assignedTasks: [{ id: 't-1', projectId: 'p-2', projectName: 'B', shotCode: null, assetCode: null, stepName: 'video', status: 'running', dueDate: null }],
      },
    })

    expect(vm.summary).toEqual({
      activeProjects: 2,
      warningCount: 0,
      reviewCount: 1,
      totalCostLabel: '¥10',
    })
  })
})
```

- [ ] **Step 2: Run the new workspace-home tests and verify they fail**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/workspace-home-view-model.test.ts
```

Expected:

```text
FAIL  tests/unit/workspace/workspace-home-view-model.test.ts
Error: Cannot find module '@/lib/ui/workspace-home-view-model'
```

- [ ] **Step 3: Implement the view-model helper and new control-room sections**

Create `src/lib/ui/workspace-home-view-model.ts`:

```ts
type WorkspaceHomeInput = {
  projects: Array<{ id: string; name: string; updatedAt: string; totalCost?: number }>
  dashboardData: {
    assignedTasks: Array<{ id: string; projectId: string; projectName: string; stepName: string; status: string; shotCode: string | null; assetCode: string | null }>
    reviewQueue: Array<{ id: string }>
  } | null
}

export function buildWorkspaceHomeViewModel(input: WorkspaceHomeInput) {
  const assignedTasks = input.dashboardData?.assignedTasks ?? []
  const failedTasks = assignedTasks.filter((task) => task.status === 'failed')
  const runningTasks = assignedTasks.filter((task) => task.status === 'running')

  return {
    summary: {
      activeProjects: input.projects.length,
      warningCount: failedTasks.length,
      reviewCount: input.dashboardData?.reviewQueue.length ?? 0,
      totalCostLabel: `¥${input.projects.reduce((sum, project) => sum + (project.totalCost ?? 0), 0).toFixed(0)}`,
    },
    continueCards: [
      ...failedTasks.map((task) => ({
        kind: 'failed-task' as const,
        projectId: task.projectId,
        title: task.projectName,
        stage: task.stepName,
      })),
      ...runningTasks.map((task) => ({
        kind: 'running-task' as const,
        projectId: task.projectId,
        title: task.projectName,
        stage: task.stepName,
      })),
    ],
  }
}
```

Create the new sections:

```tsx
// src/app/[locale]/workspace/components/WorkspaceOverviewStrip.tsx
export default function WorkspaceOverviewStrip({ summary }: { summary: { activeProjects: number; warningCount: number; reviewCount: number; totalCostLabel: string } }) {
  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <article className="studio-panel p-5">
        <p className="text-xs text-[var(--glass-text-tertiary)]">Active Projects</p>
        <p className="mt-2 text-2xl font-semibold text-[var(--glass-text-primary)]">{summary.activeProjects}</p>
      </article>
      <article className="studio-panel p-5">
        <p className="text-xs text-[var(--glass-text-tertiary)]">Warnings</p>
        <p className="mt-2 text-2xl font-semibold text-[var(--glass-tone-warning-fg)]">{summary.warningCount}</p>
      </article>
      <article className="studio-panel p-5">
        <p className="text-xs text-[var(--glass-text-tertiary)]">Ready For Review</p>
        <p className="mt-2 text-2xl font-semibold text-[var(--glass-text-primary)]">{summary.reviewCount}</p>
      </article>
      <article className="studio-panel p-5">
        <p className="text-xs text-[var(--glass-text-tertiary)]">Total Cost</p>
        <p className="mt-2 text-2xl font-semibold text-[var(--glass-text-primary)]">{summary.totalCostLabel}</p>
      </article>
    </section>
  )
}
```

```tsx
// src/app/[locale]/workspace/components/WorkspaceContinuePanel.tsx
export default function WorkspaceContinuePanel({ cards }: { cards: Array<{ kind: 'failed-task' | 'running-task'; projectId: string; title: string; stage: string }> }) {
  return (
    <section className="studio-panel p-6">
      <h2 className="text-lg font-semibold">Continue Working</h2>
      <div className="mt-4 grid gap-3">
        {cards.map((card) => (
          <a
            key={`${card.kind}:${card.projectId}:${card.stage}`}
            href={`/workspace/${card.projectId}?stage=${card.stage}`}
            className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface-strong)] px-4 py-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--glass-text-primary)]">{card.title}</span>
              <span className="text-xs text-[var(--glass-text-tertiary)]">{card.stage}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--glass-text-secondary)]">
              {card.kind === 'failed-task' ? 'Resolve the failed run and continue production.' : 'Resume the current production stage.'}
            </p>
          </a>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Refactor the page component to use the new sections and shrink the page file**

Update `src/app/[locale]/workspace/page.tsx`:

```tsx
import { buildWorkspaceHomeViewModel } from '@/lib/ui/workspace-home-view-model'
import WorkspaceOverviewStrip from './components/WorkspaceOverviewStrip'
import WorkspaceContinuePanel from './components/WorkspaceContinuePanel'
import WorkspaceProjectSection from './components/WorkspaceProjectSection'

const vm = buildWorkspaceHomeViewModel({ projects, dashboardData })

return (
  <div className="studio-surface-light glass-page min-h-screen">
    <Navbar />
    <main className="studio-shell px-4 py-6">
      <WorkspaceOverviewStrip summary={vm.summary} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <WorkspaceContinuePanel cards={vm.continueCards} />
        <WorkspaceProjectSection
          projects={projects}
          onCreateProject={() => setShowCreateModal(true)}
        />
      </div>
    </main>
  </div>
)
```

Also simplify `ProducerDashboard.tsx` into a thin adapter that only renders the new sections, then remove the old “recent project list as the home” markup from that component in the same patch.

- [ ] **Step 5: Run focused tests and file-size guard checks**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/workspace-home-view-model.test.ts
npx eslint src/app/[locale]/workspace/page.tsx src/app/[locale]/workspace/components/WorkspaceOverviewStrip.tsx src/app/[locale]/workspace/components/WorkspaceContinuePanel.tsx src/app/[locale]/workspace/components/WorkspaceProjectSection.tsx src/lib/ui/workspace-home-view-model.ts
npm run check:file-line-count
```

Expected:

```text
1 passed
0 problems
All file line count checks passed
```

## Task 3: Rebuild `/workspace/[projectId]` into a Storyboard-Centered Production Shell

**Files:**
- Modify: `src/app/[locale]/workspace/[projectId]/page.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/NovelPromotionWorkspace.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/StageNavigation.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/WorkspaceHeaderShell.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/WorkspaceStageContent.tsx`
- Create: `src/lib/ui/project-workspace-view-model.ts`
- Create: `src/app/[locale]/workspace/[projectId]/components/ProjectStudioShell.tsx`
- Create: `src/app/[locale]/workspace/[projectId]/components/ProjectControlBar.tsx`
- Create: `src/app/[locale]/workspace/[projectId]/components/ProjectResultRail.tsx`
- Create: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/StoryboardHeroPanel.tsx`
- Test: `tests/unit/workspace/project-workspace-view-model.test.ts`

- [ ] **Step 1: Write failing tests for project-shell emphasis logic**

```ts
import { describe, expect, it } from 'vitest'
import { buildProjectWorkspaceViewModel } from '@/lib/ui/project-workspace-view-model'

describe('buildProjectWorkspaceViewModel', () => {
  it('treats storyboard as the hero surface when current stage is storyboard', () => {
    const vm = buildProjectWorkspaceViewModel({
      currentStage: 'storyboard',
      selectedEpisodeName: 'Episode 3',
      hasPendingFailures: true,
      recentResultCount: 2,
    })

    expect(vm.surface).toBe('adaptive')
    expect(vm.heroTitle).toBe('Episode 3')
    expect(vm.primaryAction.kind).toBe('continue-storyboard')
    expect(vm.resultRailTone).toBe('warning')
  })

  it('switches to dark surface for editor-like stages', () => {
    const vm = buildProjectWorkspaceViewModel({
      currentStage: 'editor',
      selectedEpisodeName: 'Episode 3',
      hasPendingFailures: false,
      recentResultCount: 0,
    })

    expect(vm.surface).toBe('dark')
    expect(vm.primaryAction.kind).toBe('open-editor')
  })
})
```

- [ ] **Step 2: Run the project-shell tests and verify they fail**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/project-workspace-view-model.test.ts
```

Expected:

```text
FAIL  tests/unit/workspace/project-workspace-view-model.test.ts
Error: Cannot find module '@/lib/ui/project-workspace-view-model'
```

- [ ] **Step 3: Implement the project workspace view-model**

Create `src/lib/ui/project-workspace-view-model.ts`:

```ts
import { resolveProjectStageSurface } from '@/lib/ui/studio-surface'

type ProjectWorkspaceInput = {
  currentStage: string
  selectedEpisodeName: string
  hasPendingFailures: boolean
  recentResultCount: number
}

export function buildProjectWorkspaceViewModel(input: ProjectWorkspaceInput) {
  return {
    surface: resolveProjectStageSurface(input.currentStage),
    heroTitle: input.selectedEpisodeName,
    primaryAction: input.currentStage === 'editor'
      ? { kind: 'open-editor' as const }
      : { kind: 'continue-storyboard' as const },
    resultRailTone: input.hasPendingFailures ? 'warning' : input.recentResultCount > 0 ? 'info' : 'neutral',
  }
}
```

- [ ] **Step 4: Add the new shell components and wrap the existing stage tree instead of rewriting it**

Create the shell:

```tsx
// src/app/[locale]/workspace/[projectId]/components/ProjectStudioShell.tsx
export default function ProjectStudioShell({
  surfaceClassName,
  controlBar,
  stageRail,
  hero,
  resultRail,
}: {
  surfaceClassName: string
  controlBar: React.ReactNode
  stageRail: React.ReactNode
  hero: React.ReactNode
  resultRail: React.ReactNode
}) {
  return (
    <section className={`${surfaceClassName} studio-shell`}>
      <div className="mb-4">{controlBar}</div>
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside>{stageRail}</aside>
        <div className="min-w-0">{hero}</div>
        <aside>{resultRail}</aside>
      </div>
    </section>
  )
}
```

Wrap the current novel-promotion stage tree in `NovelPromotionWorkspace.tsx`:

```tsx
const workspaceVm = buildProjectWorkspaceViewModel({
  currentStage: vm.stageNav.currentStage,
  selectedEpisodeName: props.episode?.name ?? project.name,
  hasPendingFailures: vm.execution.scriptToStoryboardStream.isError || vm.execution.storyToScriptStream.isError,
  recentResultCount: vm.project.projectStoryboards.length,
})

return (
  <div className={STUDIO_SURFACE_CLASSNAMES[workspaceVm.surface]}>
    <ProjectControlBar
      projectName={project.name}
      currentStage={vm.stageNav.currentStage}
      episodeName={props.episode?.name ?? null}
      onRefresh={() => vm.ui.onRefresh({ mode: 'full' })}
      onOpenSettings={() => vm.ui.setIsSettingsModalOpen(true)}
      primaryAction={workspaceVm.primaryAction}
    />
    <ProjectStudioShell
      surfaceClassName={STUDIO_SURFACE_CLASSNAMES[workspaceVm.surface]}
      stageRail={
        <StageNavigation
          currentStage={vm.stageNav.currentStage}
          onStageChange={vm.stageNav.handleStageChange}
          projectId={projectId}
          episodeId={episodeId}
          hasTextStoryboards={vm.project.projectStoryboards.length > 0}
          hasStoryboards={vm.project.projectStoryboards.length > 0}
        />
      }
      hero={<WorkspaceStageContent currentStage={vm.stageNav.currentStage} />}
      resultRail={
        <ProjectResultRail
          tone={workspaceVm.resultRailTone}
          storyToScriptStream={vm.execution.storyToScriptStream}
          scriptToStoryboardStream={vm.execution.scriptToStoryboardStream}
          storyboardCount={vm.project.projectStoryboards.length}
        />
      }
    />
  </div>
)
```

When `currentStage === 'storyboard'`, inject the new `StoryboardHeroPanel` above the existing storyboard canvas rather than replacing `StoryboardStageShell`.

- [ ] **Step 5: Run targeted tests plus workspace guard checks**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/project-workspace-view-model.test.ts tests/unit/workspace/episode-selection.test.ts tests/unit/workspace/rebuild-confirm.test.ts
npx eslint src/app/[locale]/workspace/[projectId]/page.tsx src/app/[locale]/workspace/[projectId]/components/ProjectStudioShell.tsx src/app/[locale]/workspace/[projectId]/components/ProjectControlBar.tsx src/app/[locale]/workspace/[projectId]/components/ProjectResultRail.tsx src/lib/ui/project-workspace-view-model.ts
npm run check:file-line-count
```

Expected:

```text
3 passed
0 problems
All file line count checks passed
```

## Task 4: Rebuild `/workspace/asset-hub` into an Asset Mother-Library

**Files:**
- Modify: `src/app/[locale]/workspace/asset-hub/page.tsx`
- Modify: `src/app/[locale]/workspace/asset-hub/components/AssetGrid.tsx`
- Modify: `src/app/[locale]/workspace/asset-hub/components/FolderSidebar.tsx`
- Modify: `src/lib/query/hooks/useGlobalAssets.ts`
- Create: `src/lib/ui/asset-hub-view-model.ts`
- Create: `src/app/[locale]/workspace/asset-hub/components/AssetHubSummaryStrip.tsx`
- Create: `src/app/[locale]/workspace/asset-hub/components/AssetHubTypeTabs.tsx`
- Create: `src/app/[locale]/workspace/asset-hub/components/AssetHubDetailPanel.tsx`
- Test: `tests/unit/workspace/asset-hub-view-model.test.ts`

- [ ] **Step 1: Write failing tests for asset-hub summary and default focus behavior**

```ts
import { describe, expect, it } from 'vitest'
import { buildAssetHubViewModel } from '@/lib/ui/asset-hub-view-model'

describe('buildAssetHubViewModel', () => {
  it('computes summary counts by type', () => {
    const vm = buildAssetHubViewModel({
      characters: [{ id: 'c-1', name: 'Hero', updatedAt: '2026-03-29T09:00:00.000Z' }],
      locations: [{ id: 'l-1', name: 'Street', updatedAt: '2026-03-29T08:00:00.000Z' }],
      voices: [{ id: 'v-1', name: 'Narrator', updatedAt: '2026-03-29T07:00:00.000Z' }],
    })

    expect(vm.summary).toEqual({
      characterCount: 1,
      locationCount: 1,
      voiceCount: 1,
    })
  })

  it('pins the most recently updated asset into the detail panel', () => {
    const vm = buildAssetHubViewModel({
      characters: [{ id: 'c-1', name: 'Hero', updatedAt: '2026-03-29T09:00:00.000Z' }],
      locations: [{ id: 'l-1', name: 'Street', updatedAt: '2026-03-29T08:00:00.000Z' }],
      voices: [],
    })

    expect(vm.pinnedAsset).toMatchObject({ id: 'c-1', type: 'character', name: 'Hero' })
  })
})
```

- [ ] **Step 2: Run the asset-hub tests and verify they fail**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/asset-hub-view-model.test.ts
```

Expected:

```text
FAIL  tests/unit/workspace/asset-hub-view-model.test.ts
Error: Cannot find module '@/lib/ui/asset-hub-view-model'
```

- [ ] **Step 3: Implement the asset-hub view-model**

Create `src/lib/ui/asset-hub-view-model.ts`:

```ts
type TimestampedAsset = { id: string; name: string; updatedAt: string }

export function buildAssetHubViewModel(input: {
  characters: TimestampedAsset[]
  locations: TimestampedAsset[]
  voices: TimestampedAsset[]
}) {
  const pinnedAsset = [
    ...input.characters.map((asset) => ({ ...asset, type: 'character' as const })),
    ...input.locations.map((asset) => ({ ...asset, type: 'location' as const })),
    ...input.voices.map((asset) => ({ ...asset, type: 'voice' as const })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null

  return {
    summary: {
      characterCount: input.characters.length,
      locationCount: input.locations.length,
      voiceCount: input.voices.length,
    },
    pinnedAsset,
  }
}
```

Extend `src/lib/query/hooks/useGlobalAssets.ts` so the hook result types expose the timestamps needed by the new recency-driven shell:

```ts
export interface GlobalCharacter {
  id: string
  name: string
  folderId: string | null
  customVoiceUrl: string | null
  updatedAt: string
  appearances: GlobalCharacterAppearance[]
}

export interface GlobalLocation {
  id: string
  name: string
  summary: string | null
  folderId: string | null
  updatedAt: string
  images: GlobalLocationImage[]
}

export interface GlobalVoice {
  id: string
  name: string
  description: string | null
  voiceId: string | null
  voiceType: string
  customVoiceUrl: string | null
  updatedAt: string
  language: string
  folderId: string | null
}
```

- [ ] **Step 4: Recompose the page into summary strip + type tabs + detail panel**

Create the new page sections:

```tsx
// src/app/[locale]/workspace/asset-hub/components/AssetHubSummaryStrip.tsx
export default function AssetHubSummaryStrip({ summary }: { summary: { characterCount: number; locationCount: number; voiceCount: number } }) {
  return <section className="grid gap-4 md:grid-cols-3">{/* 3 summary cards */}</section>
}
```

```tsx
// src/app/[locale]/workspace/asset-hub/components/AssetHubDetailPanel.tsx
export default function AssetHubDetailPanel({ pinnedAsset }: { pinnedAsset: { id: string; type: 'character' | 'location' | 'voice'; name: string } | null }) {
  if (!pinnedAsset) return <aside className="studio-panel p-5">No assets yet</aside>
  return <aside className="studio-panel p-5">{pinnedAsset.name}</aside>
}
```

Refactor `src/app/[locale]/workspace/asset-hub/page.tsx`:

```tsx
const vm = buildAssetHubViewModel({
  characters: characters.map((item) => ({ id: item.id, name: item.name, updatedAt: item.updatedAt })),
  locations: locations.map((item) => ({ id: item.id, name: item.name, updatedAt: item.updatedAt })),
  voices: voices.map((item) => ({ id: item.id, name: item.name, updatedAt: item.updatedAt })),
})

return (
  <div className="studio-surface-adaptive glass-page min-h-screen">
    <Navbar />
    <main className="studio-shell px-4 py-6">
      <AssetHubSummaryStrip summary={vm.summary} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <FolderSidebar
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={() => setShowFolderModal(true)}
          onEditFolder={(folder) => {
            setEditingFolder(folder)
            setShowFolderModal(true)
          }}
          onDeleteFolder={handleDeleteFolder}
        />
        <AssetGrid
          characters={characters}
          locations={locations}
          voices={voices}
          loading={loading}
          onAddCharacter={() => setShowAddCharacter(true)}
          onAddLocation={() => setShowAddLocation(true)}
          onAddVoice={() => setShowAddVoice(true)}
          selectedFolderId={selectedFolderId}
          onImageClick={setPreviewImage}
          onImageEdit={handleOpenImageEdit}
          onVoiceDesign={handleOpenVoiceDesign}
          onCharacterEdit={handleOpenCharacterEdit}
          onLocationEdit={handleOpenLocationEdit}
          onVoiceSelect={setVoicePickerCharacterId}
        />
        <AssetHubDetailPanel pinnedAsset={vm.pinnedAsset} />
      </div>
    </main>
  </div>
)
```

- [ ] **Step 5: Run asset-hub tests and optimistic regression tests**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/asset-hub-view-model.test.ts tests/unit/optimistic/asset-hub-mutations.test.ts tests/unit/optimistic/project-asset-mutations.test.ts
npx eslint src/app/[locale]/workspace/asset-hub/page.tsx src/app/[locale]/workspace/asset-hub/components/AssetGrid.tsx src/app/[locale]/workspace/asset-hub/components/AssetHubSummaryStrip.tsx src/app/[locale]/workspace/asset-hub/components/AssetHubTypeTabs.tsx src/app/[locale]/workspace/asset-hub/components/AssetHubDetailPanel.tsx src/lib/ui/asset-hub-view-model.ts
npm run check:file-line-count
```

Expected:

```text
3 passed
0 problems
All file line count checks passed
```

## Task 5: Apply Motion, Finish Cross-Surface Polish, and Run Full Verification

**Files:**
- Modify: `src/styles/motion-tokens.css`
- Modify: `src/styles/animations.css`
- Modify: `src/lib/ui/motion.ts`
- Modify: `src/app/[locale]/workspace/page.tsx`
- Modify: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/NovelPromotionWorkspace.tsx`
- Modify: `src/app/[locale]/workspace/asset-hub/page.tsx`
- Test: `tests/unit/workspace/motion-presets.test.ts`

- [ ] **Step 1: Write or extend failing tests for final motion values**

```ts
import { describe, expect, it } from 'vitest'
import { MOTION_PRESETS } from '@/lib/ui/motion'

describe('studio motion timing', () => {
  it('uses the approved page-enter duration and easing', () => {
    expect(MOTION_PRESETS.pageEnter.duration).toBe(0.32)
    expect(MOTION_PRESETS.pageEnter.ease).toEqual([0.22, 1, 0.36, 1])
  })

  it('keeps button press interaction subtle', () => {
    expect(MOTION_PRESETS.press.scale).toBe(0.99)
  })
})
```

- [ ] **Step 2: Run the motion test and verify failure if values drift**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/motion-presets.test.ts
```

Expected:

```text
FAIL when durations or easing do not match the approved studio values
```

- [ ] **Step 3: Apply the final motion classes and remove float-heavy decorative motion from production surfaces**

Update `src/styles/animations.css` and page wrappers:

```css
.animate-page-enter {
  animation: page-enter var(--motion-duration-slow) var(--motion-ease-standard) both;
}

@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-card-enter {
  animation: card-enter var(--motion-duration-base) var(--motion-ease-standard) both;
}
```

Update page wrappers to use the new classes sparingly:

```tsx
<main className="studio-shell px-4 py-6 animate-page-enter">
  <WorkspaceOverviewStrip summary={vm.summary} />
  <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
    <WorkspaceContinuePanel cards={vm.continueCards} />
    <WorkspaceProjectSection
      projects={projects}
      onCreateProject={() => setShowCreateModal(true)}
    />
  </div>
</main>
```

Remove or isolate the existing ambient `animate-float*` classes from workspace production surfaces so they remain available for landing-only use and do not leak into control-room pages.

- [ ] **Step 4: Run targeted tests, lint, and the required regression suite**

Run:

```bash
BILLING_TEST_BOOTSTRAP=0 npx vitest run tests/unit/workspace/studio-surface.test.ts tests/unit/workspace/workspace-home-view-model.test.ts tests/unit/workspace/project-workspace-view-model.test.ts tests/unit/workspace/asset-hub-view-model.test.ts tests/unit/workspace/motion-presets.test.ts tests/unit/workspace/episode-selection.test.ts tests/unit/workspace/rebuild-confirm.test.ts
npx eslint src/app/[locale]/workspace/page.tsx src/app/[locale]/workspace/[projectId]/page.tsx src/app/[locale]/workspace/asset-hub/page.tsx src/lib/ui/studio-surface.ts src/lib/ui/workspace-home-view-model.ts src/lib/ui/project-workspace-view-model.ts src/lib/ui/asset-hub-view-model.ts src/lib/ui/motion.ts
npm run test:regression
```

Expected:

```text
All targeted workspace tests pass
ESLint reports 0 problems
test:regression exits 0
```

- [ ] **Step 5: Manual review checklist before sign-off**

Review the implemented UI against the spec:

```text
1. /workspace first screen shows progress/result-first control room, not project-wall-first
2. /workspace/[projectId] visually treats storyboard as the production center
3. videos/voice/editor switch to dark creation surfaces without introducing a second token system
4. /workspace/asset-hub behaves like an asset mother-library, not a plain image wall
5. Surface tokens, motion tokens, and CTA hierarchy match the approved spec
```

If any item fails this checklist, fix it before declaring the feature complete.
