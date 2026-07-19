import { MDXRemote } from 'next-mdx-remote/rsc';

export default function MdxContent({ source }: { source: string }) {
  return (
    <div className="site-prose prose prose-slate max-w-none">
      <MDXRemote source={source} />
    </div>
  );
}
