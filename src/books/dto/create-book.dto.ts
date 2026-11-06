import { IsBoolean, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { IsOmittable } from '../../common/is-omittable.decorator.js';

export class CreateBookDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  author: string;

  @IsOmittable()
  @IsInt()
  year?: number;

  @IsOmittable()
  @IsBoolean()
  read?: boolean;
}
