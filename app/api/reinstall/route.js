import { managementRoutes } from "../_lib/managementTables";
import { buildReinstallSoftwareWritePayload } from "../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("reinstall", buildReinstallSoftwareWritePayload);
export const GET = handlers.GET;
export const POST = handlers.POST;
