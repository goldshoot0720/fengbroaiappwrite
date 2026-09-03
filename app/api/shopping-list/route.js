import { managementRoutes } from "../_lib/managementTables";
import { buildShoppingItemWritePayload } from "../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("shoppinglist", buildShoppingItemWritePayload);
export const GET = handlers.GET;
export const POST = handlers.POST;
