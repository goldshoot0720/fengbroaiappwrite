import { managementRoutes } from "../_lib/managementTables";
import { sanitizeQuotaRow } from "../_lib/quotaSanitize";
import { buildQuotaWritePayload } from "../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("quota", buildQuotaWritePayload, { sanitize: sanitizeQuotaRow });
export const GET = handlers.GET;
export const POST = handlers.POST;
