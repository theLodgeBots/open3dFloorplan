import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { benchmarkProject, benchmarkSizes } from '../tests/fixtures/render-benchmark.ts';
const directory = resolve(process.argv[2] || '/tmp/openplan3d-render-fixtures');
await mkdir(directory, { recursive: true });
for (const size of Object.keys(benchmarkSizes)) {
  const path = resolve(directory, `${size}.openplan.json`);
  await writeFile(path, JSON.stringify(benchmarkProject(size), null, 2) + '\n');
  console.log(path);
}
