import { managementRoutes } from "../../_lib/managementTables";
import { buildTrialPurchaseWritePayload } from "../../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("trialpurchase", buildTrialPurchaseWritePayload);
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
