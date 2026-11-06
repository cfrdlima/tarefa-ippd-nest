import { ValidateIf } from 'class-validator';

/**
 * Field may be left out, but unlike @IsOptional() an explicit null is still
 * validated, and therefore rejected.
 */
export const IsOmittable = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
