import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const DOM_CASMURRO = { title: 'Dom Casmurro', author: 'Machado de Assis' };

describe('Books (e2e)', () => {
  let app: INestApplication<App>;
  let dataDir: string;

  const startApp = async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  };
  const api = () => request(app.getHttpServer());
  const createBook = async (body: object = DOM_CASMURRO) =>
    (await api().post('/books').send(body).expect(201)).body;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'books-e2e-'));
    process.env.DATA_DIR = dataDir;
    await startApp();
  });

  afterEach(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('POST creates a book with defaults', async () => {
    const book = await createBook();
    expect(book).toMatchObject({ ...DOM_CASMURRO, read: false });
    expect(book.id).toEqual(expect.any(String));
    expect(book.createdAt).toEqual(book.updatedAt);
  });

  it('POST rejects invalid bodies', async () => {
    await api().post('/books').send({}).expect(400);
    await api().post('/books').send({ title: 'a' }).expect(400);
    await api().post('/books').send({ title: 'a', author: '' }).expect(400);
    await api()
      .post('/books')
      .send({ ...DOM_CASMURRO, year: 'x' })
      .expect(400);
    await api()
      .post('/books')
      .send({ ...DOM_CASMURRO, year: 1.5 })
      .expect(400);
    await api()
      .post('/books')
      .send({ ...DOM_CASMURRO, read: 'x' })
      .expect(400);
    await api()
      .post('/books')
      .send({ ...DOM_CASMURRO, id: 'x' })
      .expect(400);
  });

  it('GET lists and finds books', async () => {
    await api().get('/books').expect(200).expect([]);
    const book = await createBook();
    await api().get('/books').expect(200).expect([book]);
    await api().get(`/books/${book.id}`).expect(200).expect(book);
  });

  it('PUT replaces the book, resetting omitted optional fields', async () => {
    const book = await createBook({ ...DOM_CASMURRO, year: 1899, read: true });
    const { body } = await api()
      .put(`/books/${book.id}`)
      .send({ title: 'Iracema', author: 'José de Alencar' })
      .expect(200);
    expect(body).toMatchObject({
      id: book.id,
      title: 'Iracema',
      author: 'José de Alencar',
      read: false,
      createdAt: book.createdAt,
    });
    expect(body).not.toHaveProperty('year');
    await api().get(`/books/${book.id}`).expect(200).expect(body);
  });

  it('PUT requires the full body', async () => {
    const book = await createBook();
    await api().put(`/books/${book.id}`).send({ title: 'a' }).expect(400);
  });

  it('PATCH changes only the fields sent', async () => {
    const book = await createBook({ ...DOM_CASMURRO, year: 1899 });
    const { body } = await api()
      .patch(`/books/${book.id}`)
      .send({ read: true })
      .expect(200);
    expect(body).toMatchObject({
      ...DOM_CASMURRO,
      id: book.id,
      year: 1899,
      read: true,
      createdAt: book.createdAt,
    });
    await api().get(`/books/${book.id}`).expect(200).expect(body);
  });

  it('PATCH rejects invalid values, including null', async () => {
    const book = await createBook();
    await api().patch(`/books/${book.id}`).send({ author: null }).expect(400);
    await api().patch(`/books/${book.id}`).send({ year: 'x' }).expect(400);
    await api().patch(`/books/${book.id}`).send({ id: 'x' }).expect(400);
    await api().get(`/books/${book.id}`).expect(200).expect(book);
  });

  it('DELETE removes the book', async () => {
    const book = await createBook();
    await api().delete(`/books/${book.id}`).expect(204);
    await api().get(`/books/${book.id}`).expect(404);
    await api().get('/books').expect(200).expect([]);
  });

  it('returns 404 for an unknown id on every verb', async () => {
    await api().get(`/books/${MISSING_ID}`).expect(404);
    await api().put(`/books/${MISSING_ID}`).send(DOM_CASMURRO).expect(404);
    await api().patch(`/books/${MISSING_ID}`).send({ read: true }).expect(404);
    await api().delete(`/books/${MISSING_ID}`).expect(404);
  });

  it('does not lose concurrent writes', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createBook({ title: `L${i}`, author: 'A' }),
      ),
    );
    const saved = JSON.parse(readFileSync(join(dataDir, 'books.json'), 'utf8'));
    expect(saved).toHaveLength(20);
  });

  it('keeps data after the application restarts', async () => {
    const kept = await createBook();
    const removed = await createBook({ title: 'Sai', author: 'A' });
    const { body: patched } = await api()
      .patch(`/books/${kept.id}`)
      .send({ read: true })
      .expect(200);
    await api().delete(`/books/${removed.id}`).expect(204);

    await app.close();
    await startApp();

    await api().get('/books').expect(200).expect([patched]);
  });
});
