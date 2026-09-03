import { managementRoutes } from "../../_lib/managementTables";
import { buildFinanceInstrumentWritePayload } from "../../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("financeinstrument", buildFinanceInstrumentWritePayload);
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
