# Study Anchor frontend redesign — change notes

Frontend only. No files under services/, hooks/, context/, utils/ or any API/WebSocket code were touched.

## Changed files
- src/index.css — removed ruled-paper background; compact card radius; new primitives (lv-page-title, lv-chips/lv-chip, lv-tabs/lv-tab, lv-tile)
- src/components: Navbar (compact app bar + phone account menu), MobileTabBar (5 slots, "More" grid sheet), Sidebar, NotificationBell (phone trigger), BrandMark (now honours className), Button, Badge, EmptyState, Modal (bottom sheet), FormFields, Loader (compact skeletons), MaterialCard (compact row), StreakCard, rooms/roomUi (compact RoomCard)
- src/config/navItems.jsx — `tab` / `short` flags choose phone tab-bar items (no routes changed)
- src/pages: AppShell, student/StudentDashboard, student/ExploreFeedPage, student/CoursePage, student/LibraryPage, student/PointsPage, study/StudyToolsPage, rooms/RoomsPage

## Not yet done
Snap/Flashcards/Mock-exam inner pages, room chat screen, Goals, Analytics, Profile, admin/rep pages (they inherit the new shell, buttons, cards, modals).

## Not verified
Build and tests were NOT run (no network / node_modules in the sandbox). Run `npm install && npm run build`.
Pages import SVGs from /public (Books.svg etc.) — restore the public folder before building.
