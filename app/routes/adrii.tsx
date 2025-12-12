import type { Route } from "./+types/home";
import { Adrii } from "../pages/adrii/adrii";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Adrii" },
    { name: "description", content: "AAA" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <Adrii />;
}
