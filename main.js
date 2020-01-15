const { basename, extname, join } = require('path');
const fs = require('fs').promises;
const child_process = require('child_process');
const { Worker, isMainThread, parentPort } = require('worker_threads');

const MAX = 8;

async function main() {
	if (isMainThread) {
		const dir = await fs.readdir(process.cwd(), {withFileTypes: true});
		const map = dir.filter(d => d.isDirectory()).map(m => m.name);
		console.log(`count: ${map.length}`)

		const end = map.length;
		let last = 0;
		for (let i = 0; i < (MAX > end ? end : MAX); i++) {
			const worker = new Worker(require.resolve(__filename));
			worker.postMessage(map[last++]);

			worker.on('message', d => {
				console.log(`DIR ${last} of ${end} ended.`);
				if(last < end)
					worker.postMessage(map[last++]);
				else {
					worker.terminate();
					console.log('ALL ENDED');
				}
			});
			worker.on('error', e => console.log(`${e}`));
			worker.on('exit', c => console.log(`exit? ${c}`));
		}
	} else {
		async function ffmpeg (input, output) {
			return new Promise((resolve, reject) => {
				const pro = child_process.spawn(`ffmpeg`,
						['-y', '-i', `${input}`, '-q:v', '1', '-vf', "scale=1200:-1", `${output}.jpg`],
						{ cwd: process.cwd() })
				pro.on('close', c => resolve(c));
				pro.stdout.on('data', s => console.log(s.toString()));
				pro.stderr.on('data', e => {reject(e)});
			})
		}

		async function convert(dirname) {
			const dir = await fs.readdir(dirname);
			const files = dir.filter(f => (extname(f)==='.png'||extname(f)==='.jpg'));
			console.log(files.length)
			for (const f of files) {
				const filePath = join(dirname, f);
				const filePathBase = join( dirname, basename(f,extname(f)) );
				//await ffmpeg(filePath, filePathBase).catch(e => console.error(e.toString()));
				const a = child_process.execSync(`ffmpeg -y -i "${filePath}" -q:v 1 -vf "scale=1200:-1" "${filePathBase}.jpg"`, {stdio: 'ignore'})
				if (extname(f) === '.png') await fs.unlink(filePath);
			}
			return dirname;
		}

		parentPort.on('message', async n => {
			console.log(`Start: ${n}`)
			await convert(n);
			parentPort.postMessage(n)
		})
	}
}

main()
