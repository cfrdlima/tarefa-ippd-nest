import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Tasks (e2e)', () => {
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
  const createTask = async (body: object = { title: 'Estudar' }) =>
    (await api().post('/tasks').send(body).expect(201)).body;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'tasks-e2e-'));
    process.env.DATA_DIR = dataDir;
    await startApp();
  });

  afterEach(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('POST creates a task with defaults', async () => {
    const task = await createTask();
    expect(task).toMatchObject({ title: 'Estudar', completed: false });
    expect(task.id).toEqual(expect.any(String));
    expect(task.createdAt).toEqual(task.updatedAt);
  });

  it('POST rejects invalid bodies', async () => {
    await api().post('/tasks').send({}).expect(400);
    await api().post('/tasks').send({ title: '' }).expect(400);
    await api().post('/tasks').send({ title: 1 }).expect(400);
    await api().post('/tasks').send({ title: 'a', completed: 'x' }).expect(400);
    await api()
      .post('/tasks')
      .send({ title: 'a', description: null })
      .expect(400);
    await api().post('/tasks').send({ title: 'a', id: 'x' }).expect(400);
  });

  it('GET lists and finds tasks', async () => {
    await api().get('/tasks').expect(200).expect([]);
    const task = await createTask();
    await api().get('/tasks').expect(200).expect([task]);
    await api().get(`/tasks/${task.id}`).expect(200).expect(task);
  });

  it('PUT replaces the task, resetting omitted optional fields', async () => {
    const task = await createTask({
      title: 'Estudar',
      description: 'NestJS',
      completed: true,
    });
    const { body } = await api()
      .put(`/tasks/${task.id}`)
      .send({ title: 'Revisar' })
      .expect(200);
    expect(body).toMatchObject({
      id: task.id,
      title: 'Revisar',
      completed: false,
      createdAt: task.createdAt,
    });
    expect(body).not.toHaveProperty('description');
    await api().get(`/tasks/${task.id}`).expect(200).expect(body);
  });

  it('PUT requires the full body', async () => {
    const task = await createTask();
    await api().put(`/tasks/${task.id}`).send({ completed: true }).expect(400);
  });

  it('PATCH changes only the fields sent', async () => {
    const task = await createTask({ title: 'Estudar', description: 'NestJS' });
    const { body } = await api()
      .patch(`/tasks/${task.id}`)
      .send({ completed: true })
      .expect(200);
    expect(body).toMatchObject({
      id: task.id,
      title: 'Estudar',
      description: 'NestJS',
      completed: true,
      createdAt: task.createdAt,
    });
    await api().get(`/tasks/${task.id}`).expect(200).expect(body);
  });

  it('PATCH rejects invalid values, including null', async () => {
    const task = await createTask();
    await api().patch(`/tasks/${task.id}`).send({ title: null }).expect(400);
    await api().patch(`/tasks/${task.id}`).send({ title: '' }).expect(400);
    await api().patch(`/tasks/${task.id}`).send({ id: 'x' }).expect(400);
    await api().get(`/tasks/${task.id}`).expect(200).expect(task);
  });

  it('DELETE removes the task', async () => {
    const task = await createTask();
    await api().delete(`/tasks/${task.id}`).expect(204);
    await api().get(`/tasks/${task.id}`).expect(404);
    await api().get('/tasks').expect(200).expect([]);
  });

  it('returns 404 for an unknown id on every verb', async () => {
    await api().get(`/tasks/${MISSING_ID}`).expect(404);
    await api().put(`/tasks/${MISSING_ID}`).send({ title: 'a' }).expect(404);
    await api().patch(`/tasks/${MISSING_ID}`).send({ title: 'a' }).expect(404);
    await api().delete(`/tasks/${MISSING_ID}`).expect(404);
  });

  it('does not lose concurrent writes', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => createTask({ title: `T${i}` })),
    );
    const saved = JSON.parse(readFileSync(join(dataDir, 'tasks.json'), 'utf8'));
    expect(saved).toHaveLength(20);
  });

  it('keeps data after the application restarts', async () => {
    const kept = await createTask({ title: 'Fica' });
    const removed = await createTask({ title: 'Sai' });
    const { body: patched } = await api()
      .patch(`/tasks/${kept.id}`)
      .send({ completed: true })
      .expect(200);
    await api().delete(`/tasks/${removed.id}`).expect(204);

    await app.close();
    await startApp();

    await api().get('/tasks').expect(200).expect([patched]);
  });
});
