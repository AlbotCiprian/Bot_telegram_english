import http from "node:http";
import { config } from "../utils/config.js";

type DockerContainer = {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
};

function dockerRequest(path: string, method: "GET" | "POST" = "GET"): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath: config.DOCKER_SOCKET_PATH,
        path,
        method,
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`Docker API ${method} ${path} a raspuns cu ${response.statusCode}: ${data}`));
            return;
          }

          resolve(data);
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

export async function listContainers(): Promise<DockerContainer[]> {
  const response = await dockerRequest("/containers/json?all=1");
  return JSON.parse(response) as DockerContainer[];
}

export async function restartContainer(containerName: string): Promise<void> {
  await dockerRequest(`/containers/${containerName}/restart?t=10`, "POST");
}

export async function getContainerLogs(containerName: string, tailLines: number): Promise<string> {
  const tail = Math.max(tailLines, 1);
  return dockerRequest(`/containers/${containerName}/logs?stdout=1&stderr=1&tail=${tail}`);
}
