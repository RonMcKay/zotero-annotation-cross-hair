import { config } from "../package.json";
import hooks from "./hooks";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "development" | "production";
    initialized: boolean;
    rootURI: string;
  };
  public hooks: typeof hooks;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      rootURI,
    };
    this.hooks = hooks;
  }
}

export default Addon;
