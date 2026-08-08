/** Resolve the public FXServer HTTP port from the first active TCP endpoint. */
export const getTcpPortFromServerCfg = (cfg: string, fallback?: number) => {
    const endpointMatch = /^\s*endpoint_add_tcp\s+(?:"([^"]+)"|'([^']+)'|(\S+))/mi.exec(cfg);
    const endpoint = endpointMatch?.[1] || endpointMatch?.[2] || endpointMatch?.[3];
    const portMatch = endpoint ? /:(\d{1,5})$/.exec(endpoint) : null;
    const port = portMatch ? Number(portMatch[1]) : NaN;
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
    if (fallback && Number.isInteger(fallback) && fallback > 0 && fallback <= 65535) return fallback;
    return 30120;
};
