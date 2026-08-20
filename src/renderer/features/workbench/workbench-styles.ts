/**
 * Workbench CSS has several historical shared `wb-*` primitives. Loading those
 * files from lazy surfaces made the cascade depend on navigation history: once
 * a surface was visited its stylesheet stayed mounted and could restyle another
 * surface. Import every workbench stylesheet here in one reviewed order so the
 * cascade is complete before the first workbench render.
 *
 * Order: legacy/broad foundations first, surface-specific refinements next,
 * static shell chrome is imported directly by AppShell after this registry.
 * Lazy surfaces must not inject any of these stylesheets into production chunks.
 */
import '../run/console.css'
import './workbench-layout.css'
import '../shelf/shelf.css'
import './workbench-daemon.css'
import './workbench-studio.css'
import '../expert/expert-workbench.css'
import '../workflow/workflow-room.css'
