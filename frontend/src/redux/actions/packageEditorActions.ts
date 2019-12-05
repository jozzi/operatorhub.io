import { PackageEntry, PacakgeEditorChannel, PackageEditorOperatorVersionsMap, PackageEditorOperatorVersionMetadata } from '../../utils/packageEditorTypes';

export type BoundActionCreator<T extends (...args: any) => any> = (...args: Parameters<T>) => void;

export const resetPackageEditorAction = () => ({
  type: 'RESET_PACKAGE_EDITOR' as 'RESET_PACKAGE_EDITOR'
});

export const setPackageNameAction = (packageName: string) => ({
  type: 'SET_PACKAGE_EDITOR_PACKAGE_NAME' as 'SET_PACKAGE_EDITOR_PACKAGE_NAME',
  packageName
});

export const setPackageUploadsAction = (uploads: PackageEntry[]) => ({
  type: 'SET_PACKAGE_EDITOR_UPLOADS' as 'SET_PACKAGE_EDITOR_UPLOADS',
  uploads
});


export const removePackageUploadAction = (path: string, nested: boolean) => ({
  type: 'REMOVE_PACKAGE_EDITOR_UPLOAD' as 'REMOVE_PACKAGE_EDITOR_UPLOAD',
  path,
  nested
});

export const clearPackageUploadsAction = () => ({
  type: 'CLEAR_PACKAGE_EDITOR_UPLOADS' as 'CLEAR_PACKAGE_EDITOR_UPLOADS'
});

export const showGithubPackageUploadAction = () => ({
  type: 'SHOW_PACKAGE_EDITOR_GITHUB_UPLOAD' as 'SHOW_PACKAGE_EDITOR_GITHUB_UPLOAD'
});

export const hideGithubPackageUploadAction = () => ({
  type: 'HIDE_PACKAGE_EDITOR_GITHUB_UPLOAD' as 'HIDE_PACKAGE_EDITOR_GITHUB_UPLOAD'
});

export const setPackageChannelsAction = (channels: PacakgeEditorChannel[]) => ({
  type: 'SET_PACKAGE_EDITOR_CHANNELS' as 'SET_PACKAGE_EDITOR_CHANNELS',
  channels
});

export const updatePackageChannelAction = (name: string, change: Partial<PacakgeEditorChannel>) => ({
  type: 'UPDATE_PACKAGE_EDITOR_CHANNEL' as 'UPDATE_PACKAGE_EDITOR_CHANNEL',
  name,
  change
}); 

export const addNewPackageChannelAction = (name: string) => ({
  type: 'NEW_PACKAGE_EDITOR_CHANNEL' as 'NEW_PACKAGE_EDITOR_CHANNEL',
  newChannel: {
    name,
    currentVersion: '',
    currentVersionFullName: '',
    isDefault: false,
    versions: []
}
});

export const makePackageChannelDefaultAction = (name: string) => ({
  type: 'MAKE_PACKAGE_EDITOR_CHANNEL_DEFAULT' as 'MAKE_PACKAGE_EDITOR_CHANNEL_DEFAULT',
  name,
});

export const removePackageChannelAction = (name: string) => ({
  type: 'REMOVE_PACKAGE_EDITOR_CHANNEL' as 'REMOVE_PACKAGE_EDITOR_CHANNEL',
  name,
});

export const setPackageOperatorVersionsAction = (operatorVersions: PackageEditorOperatorVersionsMap) => ({
  type: 'SET_PACKAGE_EDITOR_OPERATOR_VERSIONS' as 'SET_PACKAGE_EDITOR_OPERATOR_VERSIONS',
  operatorVersions
});

export const updatePackageOperatorVersionAction = (operatorVersion: PackageEditorOperatorVersionMetadata) => ({
  type: 'UPDATE_PACKAGE_EDITOR_OPERATOR_VERSION' as 'UPDATE_PACKAGE_EDITOR_OPERATOR_VERSION',
  operatorVersion
});


export type PackageEditorActions = ReturnType<typeof resetPackageEditorAction> | ReturnType<typeof setPackageNameAction> |
 ReturnType<typeof setPackageUploadsAction> | ReturnType<typeof removePackageUploadAction> |
  ReturnType<typeof clearPackageUploadsAction> | ReturnType<typeof showGithubPackageUploadAction> |
  ReturnType<typeof hideGithubPackageUploadAction> | ReturnType<typeof setPackageChannelsAction> | 
  ReturnType<typeof setPackageOperatorVersionsAction> | ReturnType<typeof updatePackageChannelAction> |
  ReturnType<typeof addNewPackageChannelAction> | ReturnType<typeof makePackageChannelDefaultAction> |
  ReturnType<typeof removePackageChannelAction> | ReturnType<typeof updatePackageOperatorVersionAction>;
