import { Capacitor, registerPlugin } from '@capacitor/core';

export type OutFile = { name: string; mime: string; text: string };

type Export = {
	share: (options: { files: OutFile[] }) => Promise<void>;
};

const exporter = import.meta.env.APP_BUILD ? registerPlugin<Export>('Export') : null;

function download(file: OutFile): void {
	const url = URL.createObjectURL(new Blob([file.text], { type: file.mime }));
	const anchor = document.createElement('a');

	anchor.href = url;
	anchor.download = file.name;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();

	setTimeout(() => {
		URL.revokeObjectURL(url);
	}, 0);
}

export async function deliver(files: OutFile[]): Promise<void> {
	if (exporter !== null && Capacitor.isNativePlatform()) {
		await exporter.share({ files });
		return;
	}

	for (const file of files) {
		download(file);
	}
}
