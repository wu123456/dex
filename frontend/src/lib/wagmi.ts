import { http, createConfig } from "wagmi";
import { hardhat, mainnet, polygon, bsc } from "wagmi/chains";

const chains = [hardhat, mainnet, polygon, bsc] as const;

export const config = createConfig({
  chains,
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
  },
  ssr: true,
});

export { chains };
