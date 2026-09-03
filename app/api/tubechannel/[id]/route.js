import { managementRoutes } from "../../_lib/managementTables";
import { buildFengbroTubeChannelWritePayload } from "../../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("tubechannel", buildFengbroTubeChannelWritePayload);
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
