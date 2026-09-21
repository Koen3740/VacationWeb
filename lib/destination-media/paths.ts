import path from 'node:path';

/** Repo root = VacationWebNext (parent of lib/). */
export function getVacationWebNextRoot(): string {
  return path.join(process.cwd());
}

export function destinationMediaPoolFilePath(
  destinationId: string,
  root: string = getVacationWebNextRoot(),
): string {
  return path.join(
    root,
    'media',
    'metadata',
    'destination-media-pools',
    `pool-${destinationId}.json`,
  );
}

export function masterAbsolutePath(
  masterPath: string,
  root: string = getVacationWebNextRoot(),
): string {
  // masterPath is repo-relative, e.g. media/masters/candidates/photo/foo.jpg
  return path.join(root, ...masterPath.split('/'));
}

export function verifiedPublicRelativeDir(destinationId: string): string {
  return path.posix.join('images', 'verified', destinationId);
}

export function verifiedPublicUrl(destinationId: string, fileName: string): string {
  return `/${verifiedPublicRelativeDir(destinationId)}/${fileName}`;
}

export function verifiedAbsoluteDir(
  destinationId: string,
  root: string = getVacationWebNextRoot(),
): string {
  return path.join(root, 'public', 'images', 'verified', destinationId);
}
