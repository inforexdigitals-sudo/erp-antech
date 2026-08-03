/** Matches the CHECK constraint on document_folders.related_entity_type (db/migrations/0012). */
export const DOCUMENT_FOLDER_ENTITY_TYPES = ['project', 'customer', 'supplier', 'company'] as const;
export type DocumentFolderEntityType = (typeof DOCUMENT_FOLDER_ENTITY_TYPES)[number];

/**
 * documents.related_entity_type has no CHECK constraint (db/migrations/0012's
 * header comment lists 'project','quotation','purchase_order','claim',
 * 'variation_order','site_report',... as illustrative, not exhaustive) —
 * deliberately not modeled as a closed enum here, unlike the folder type above.
 */

/** Matches the CHECK constraint on document_permissions.permission (db/migrations/0012). */
export const DOCUMENT_PERMISSION_LEVELS = ['view', 'edit', 'delete'] as const;
export type DocumentPermissionLevel = (typeof DOCUMENT_PERMISSION_LEVELS)[number];
