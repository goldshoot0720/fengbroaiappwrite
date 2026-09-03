import { managementRoutes } from "../_lib/managementTables";
import { buildFengbroTubeChannelWritePayload } from "../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("tubechannel", buildFengbroTubeChannelWritePayload);
export const GET = handlers.GET;
export const POST = handlers.POST;
