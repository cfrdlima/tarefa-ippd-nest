import { Injectable, NotFoundException } from '@nestjs/common';
import { JsonRepository } from '../common/json-repository.js';
import type { Book } from './book.entity.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { UpdateBookDto } from './dto/update-book.dto.js';

@Injectable()
export class BooksService {
  private readonly repository = new JsonRepository<Book>('books.json');

  findAll(): Book[] {
    return this.repository.findAll();
  }

  findOne(id: string): Book {
    const book = this.repository.findById(id);
    if (!book) throw this.notFound(id);
    return book;
  }

  create(dto: CreateBookDto): Promise<Book> {
    const now = new Date().toISOString();
    return this.repository.insert((id) => ({
      id,
      title: dto.title,
      author: dto.author,
      year: dto.year,
      read: dto.read ?? false,
      createdAt: now,
      updatedAt: now,
    }));
  }

  async replace(id: string, dto: CreateBookDto): Promise<Book> {
    const book = await this.repository.update(id, (current) => ({
      id: current.id,
      title: dto.title,
      author: dto.author,
      year: dto.year,
      read: dto.read ?? false,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    }));
    if (!book) throw this.notFound(id);
    return book;
  }

  async patch(id: string, dto: UpdateBookDto): Promise<Book> {
    const book = await this.repository.update(id, (current) => ({
      ...current,
      title: dto.title ?? current.title,
      author: dto.author ?? current.author,
      year: dto.year ?? current.year,
      read: dto.read ?? current.read,
      updatedAt: new Date().toISOString(),
    }));
    if (!book) throw this.notFound(id);
    return book;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repository.remove(id))) throw this.notFound(id);
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`Book ${id} not found`);
  }
}
