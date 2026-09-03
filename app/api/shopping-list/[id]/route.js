import { managementRoutes } from "../../_lib/managementTables";
import { buildShoppingItemWritePayload } from "../../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("shoppinglist", buildShoppingItemWritePayload);
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
