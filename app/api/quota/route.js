import { managementRoutes } from "../_lib/managementTables";
import { buildQuotaWritePayload } from "../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("quota", buildQuotaWritePayload);
export const GET = handlers.GET;
export const POST = handlers.POST;
