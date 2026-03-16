import { toast } from "sonner";

export async function txToast<T>(
  promise: Promise<T>,
  loading: string,
  success: string,
  fail: string
): Promise<T> {
  const id = toast.loading(loading);

  try {
    const tx = await promise;

    toast.success(success, { id });

    return tx;
  } catch (err) {
    toast.error(fail, { id });
    throw err;
  }
}
