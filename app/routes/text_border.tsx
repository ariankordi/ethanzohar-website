import type { Route } from "./+types/home";
import { TextBorder } from "../pages/text_border/text_border";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Text Border" },
    { name: "description", content: "AAA" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <TextBorder />;
}
