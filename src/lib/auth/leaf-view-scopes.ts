import { LEAF_FOREST_VIEW_SCOPES } from "./leaf-forest-view-scopes";

export const LEAF_VIEW_SCOPES = LEAF_FOREST_VIEW_SCOPES.filter(scope => scope.pageKey.startsWith("leaf-"));
