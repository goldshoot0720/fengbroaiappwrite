import { managementRoutes } from "../../_lib/managementTables";
import { buildQuotaWritePayload } from "../../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("quota", buildQuotaWritePayload);
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
