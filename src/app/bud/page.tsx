import { redirect } from "next/navigation";

/** /bud にアクセスしたら /bud/dashboard へリダイレクト */
export default function BudRootPage() {
  redirect("/bud/dashboard");
}
