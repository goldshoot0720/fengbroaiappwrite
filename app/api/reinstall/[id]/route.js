import { managementRoutes } from "../../_lib/managementTables";
import { buildReinstallSoftwareWritePayload } from "../../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("reinstall", buildReinstallSoftwareWritePayload);
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
