import { Injectable, NotFoundException } from '@nestjs/common';
import { JsonRepository } from '../common/json-repository.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import type { Task } from './task.entity.js';

@Injectable()
export class TasksService {
  private readonly repository = new JsonRepository<Task>('tasks.json');

  findAll(): Task[] {
    return this.repository.findAll();
  }

  findOne(id: string): Task {
    const task = this.repository.findById(id);
    if (!task) throw this.notFound(id);
    return task;
  }

  create(dto: CreateTaskDto): Promise<Task> {
    const now = new Date().toISOString();
    return this.repository.insert((id) => ({
      id,
      title: dto.title,
      description: dto.description,
      completed: dto.completed ?? false,
      createdAt: now,
      updatedAt: now,
    }));
  }

  async replace(id: string, dto: CreateTaskDto): Promise<Task> {
    const task = await this.repository.update(id, (current) => ({
      id: current.id,
      title: dto.title,
      description: dto.description,
      completed: dto.completed ?? false,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    }));
    if (!task) throw this.notFound(id);
    return task;
  }

  async patch(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.repository.update(id, (current) => ({
      ...current,
      title: dto.title ?? current.title,
      description: dto.description ?? current.description,
      completed: dto.completed ?? current.completed,
      updatedAt: new Date().toISOString(),
    }));
    if (!task) throw this.notFound(id);
    return task;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repository.remove(id))) throw this.notFound(id);
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`Task ${id} not found`);
  }
}
