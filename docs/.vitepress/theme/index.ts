import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import ToolCard from "./components/ToolCard.vue";
import ToolGroup from "./components/ToolGroup.vue";
import StepList from "./components/StepList.vue";
import HomeVideoBackground from "./components/HomeVideoBackground.vue";
import HeroProjectChip from "./components/HeroProjectChip.vue";
import "./custom.css";

const theme: Theme = {
  ...DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "home-hero-before": () => h(HomeVideoBackground),
      "home-hero-info-before": () => h(HeroProjectChip)
    }),
  enhanceApp({ app }) {
    app.component("ToolCard", ToolCard);
    app.component("ToolGroup", ToolGroup);
    app.component("StepList", StepList);
  }
};

export default theme;
