import { postToBackendSocket } from "./utils/ddSocket";

postToBackendSocket({ event: 'eventLabsPromptUninstalled' });