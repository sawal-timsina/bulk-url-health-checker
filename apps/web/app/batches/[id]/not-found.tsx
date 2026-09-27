import Link from "next/link";

export default function BatchNotFound() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">Batch not found</h1>
      <Link href="/" className="text-blue-700 underline">
        Back to all batches
      </Link>
    </div>
  );
}
