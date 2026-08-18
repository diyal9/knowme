/**
 * 工作台表面注册表：测试顶层 await；生产 lazySurface。
 * AppShell 只从此处 import 并路由，禁止在壳里再写 loader。
 */
import type { ComponentType } from 'react'
import { lazySurface } from './lazySurface'
import type { SettingsSurfaceProps } from '../features/settings/SettingsSurface'

/** Keep local to avoid a locked RunSurface edit; must match RunSurface props. */
type RunSurfaceProps = { taskRoom?: boolean }

const isTest = import.meta.env.MODE === 'test'

export const ManageSurface = isTest
  ? (await import('../features/manage/ManageSurface')).ManageSurface
  : lazySurface(() => import('../features/manage/ManageSurface').then((m) => ({ default: m.ManageSurface })))
export const StudioSurface = isTest
  ? (await import('../features/studio/StudioSurface')).StudioSurface
  : lazySurface(() => import('../features/studio/StudioSurface').then((m) => ({ default: m.StudioSurface })))
export const ShelfSurface = isTest
  ? (await import('../features/shelf/ShelfSurface')).ShelfSurface
  : lazySurface(() => import('../features/shelf/ShelfSurface').then((m) => ({ default: m.ShelfSurface })))
export const TaskHomeSurface = isTest
  ? (await import('../features/taskhome/TaskHomeSurface')).TaskHomeSurface
  : lazySurface(() => import('../features/taskhome/TaskHomeSurface').then((m) => ({ default: m.TaskHomeSurface })))
export const RunSurface: ComponentType<RunSurfaceProps> = isTest
  ? (await import('../features/run/RunSurface')).RunSurface
  : lazySurface<RunSurfaceProps>(() => import('../features/run/RunSurface').then((m) => ({ default: m.RunSurface })))
export const FilesPane = isTest
  ? (await import('../features/files/FilesPane')).FilesPane
  : lazySurface(() => import('../features/files/FilesPane').then((m) => ({ default: m.FilesPane })))
export const KnowledgeSurface = isTest
  ? (await import('../features/knowledge/KnowledgeSurface')).KnowledgeSurface
  : lazySurface(() => import('../features/knowledge/KnowledgeSurface').then((m) => ({ default: m.KnowledgeSurface })))
export const SettingsSurface: ComponentType<SettingsSurfaceProps> = isTest
  ? (await import('../features/settings/SettingsSurface')).SettingsSurface
  : lazySurface<SettingsSurfaceProps>(() => import('../features/settings/SettingsSurface').then((m) => ({ default: m.SettingsSurface })))
export const CapabilityHubSurface = isTest
  ? (await import('../features/capability-hub/CapabilityHubSurface')).CapabilityHubSurface
  : lazySurface(() => import('../features/capability-hub/CapabilityHubSurface').then((m) => ({ default: m.CapabilityHubSurface })))
export const ExpertRoomSurface = isTest
  ? (await import('../features/expert/ExpertRoomSurface')).ExpertRoomSurface
  : lazySurface(() => import('../features/expert/ExpertRoomSurface').then((m) => ({ default: m.ExpertRoomSurface })))
export const TaskRoomHost = isTest
  ? (await import('../features/task-dialogue/TaskRoomHost')).TaskRoomHost
  : lazySurface(() => import('../features/task-dialogue/TaskRoomHost').then((m) => ({ default: m.TaskRoomHost })))
export const WorkflowRoomSurface = isTest
  ? (await import('../features/workflow/WorkflowRoomSurface')).WorkflowRoomSurface
  : lazySurface(() => import('../features/workflow/WorkflowRoomSurface').then((m) => ({ default: m.WorkflowRoomSurface })))
export const LinkPreviewSurface = isTest
  ? (await import('../features/link-preview/LinkPreviewSurface')).LinkPreviewSurface
  : lazySurface(() => import('../features/link-preview/LinkPreviewSurface').then((m) => ({ default: m.LinkPreviewSurface })))
