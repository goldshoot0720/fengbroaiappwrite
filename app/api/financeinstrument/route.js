import { managementRoutes } from "../_lib/managementTables";
import { buildFinanceInstrumentWritePayload } from "../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("financeinstrument", buildFinanceInstrumentWritePayload);
export const GET = handlers.GET;
export const POST = handlers.POST;
