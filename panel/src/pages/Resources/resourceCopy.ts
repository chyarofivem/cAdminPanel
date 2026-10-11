import type {
    ResourceReportError,
    ResourceUpdateCheckError,
    ResourceUpdateFailure,
} from '@shared/resourceManagerTypes';

/**
 * English source strings for backend codes. Pass each value through t() at render time.
 */
export const reportErrorCopy: Record<ResourceReportError, string> = {
    server_offline: 'Start the server to inspect its resources.',
    report_unavailable: 'The resource report could not be requested.',
    report_timeout: 'The server did not return a resource report in time.',
};

export const checkErrorCopy: Record<ResourceUpdateCheckError, string> = {
    no_release: 'The repository has no published release.',
    rate_limited: 'GitHub limits checks to 60 an hour. Try again later.',
    network: 'GitHub could not be reached.',
    invalid_response: 'GitHub returned an unexpected response.',
    unknown_version: 'The local version and the release tag cannot be compared.',
};

export const checkFailureCopy: Record<'forbidden' | 'report_unavailable', string> = {
    forbidden: 'You do not have permission to control resources.',
    report_unavailable: 'The resource report is not available yet. Refresh the list and try again.',
};

export const updateFailureCopy: Record<ResourceUpdateFailure, string> = {
    forbidden: 'Only the master account can update or roll back resources.',
    invalid_request: 'The request was not valid.',
    busy: 'Another resource update is running. Try again when it finishes.',
    server_offline: 'Start the server to update resources.',
    report_unavailable: 'The resource report is not available yet. Refresh the list and try again.',
    resource_not_found: 'The resource is no longer on the server.',
    not_updatable: 'This resource cannot be updated from the panel.',
    check_required: 'Check for updates again before updating.',
    no_asset: 'The release has no archive to install.',
    download_failed: 'The release could not be downloaded.',
    too_large: 'The release archive is too large.',
    invalid_archive: 'The release archive could not be read.',
    manifest_not_found: 'The release archive has no fxmanifest.lua.',
    path_rejected: 'The resource folder failed the safety checks.',
    backup_failed: 'The backup could not be created, so nothing was changed.',
    backup_not_found: 'That backup no longer exists.',
    swap_failed: 'The files could not be replaced. The console has the details.',
};
