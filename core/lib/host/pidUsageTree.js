import pidtree from 'pidtree';
import pidusage from 'pidusage';

/**
 * @param {number} pid
 * @returns {Promise<Record<string, import('pidusage').Status>>}
 */
export default async (pid) => {
    const pids = await pidtree(pid);
    return await pidusage([pid, ...pids]);
};
