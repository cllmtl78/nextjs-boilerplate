import { type SchemaTypeDefinition } from "sanity";
import { haberType } from "./haberType";

export const schemaTypes: SchemaTypeDefinition[] = [haberType];

export const schema = { types: schemaTypes };