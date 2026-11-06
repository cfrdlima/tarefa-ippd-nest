import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { IsOmittable } from '../../common/is-omittable.decorator.js';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOmittable()
  @IsString()
  description?: string;

  @IsOmittable()
  @IsBoolean()
  completed?: boolean;
}
