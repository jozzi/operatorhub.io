import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import _ from 'lodash-es';
import { Icon } from 'patternfly-react';
import { safeLoadAll } from 'js-yaml';

import { helpers } from '../../../common/helpers';
import UploadUrlModal from '../../modals/UploadUrlModal';
import { reduxConstants } from '../../../redux/index';
import {
  normalizeYamlOperator,
  getMissingCrdUploads,
  getUpdatedFormErrors
} from '../../../pages/operatorBundlePage/bundlePageUtils';
import {
  getDefaultOnwedCRD,
  isDeploymentDefault,
  validateOperatorPackage,
  isOwnedCrdDefault,
  convertExampleYamlToObj,
  getDefaultAlmExample,
  isAlmExampleDefault,
  getDefaultOwnedCRDResources
} from '../../../utils/operatorUtils';
import { EDITOR_STATUS, sectionsFields } from '../../../utils/constants';
import * as actions from '../../../redux/actions/editorActions';
import * as utils from './UploaderUtils';

import UploaderDropArea from './UploaderDropArea';
import UploaderObjectList from './UploaderObjectList';

const validFileTypesRegExp = new RegExp(`(${['.yaml'].join('|').replace(/\./g, '\\.')})$`, 'i');

class ManifestUploader extends React.Component {
  state = {
    uploadUrlShown: false,
    uploadExpanded: false
  };

  componentDidMount() {
    const { uploads, operator } = this.props;

    const missingCrdUploads = getMissingCrdUploads(uploads, operator).length > 0;

    this.setState({
      uploadExpanded: missingCrdUploads
    });
  }

  /**
   * Parse uploaded file
   * @param {UploadMetadata} upload upload metadata object
   */
  processUploadedObject = upload => {
    const typeAndName = utils.getObjectNameAndType(upload.data || {}, upload.fileName);

    if (!typeAndName) {
      upload.status = 'Unsupported Object';
      upload.errored = true;
      return upload;
    }

    upload.type = typeAndName.type;
    upload.name = typeAndName.name;
    upload.status = 'Supported Object';

    if (upload.type === 'ClusterServiceVersion') {
      this.processCsvFile(upload.data);
    } else if (upload.type === 'CustomResourceDefinition') {
      this.processCrdFile(upload.data);
    } else if (upload.type === 'Deployment') {
      this.processDeployment(upload.data);
    } else if (upload.type === 'Package') {
      this.processPackageFile(upload.data);
    } else if (upload.type === 'ServiceAccount') {
      this.processPermissionObject(upload);
    } else if (utils.securityObjectTypes.includes(upload.type)) {
      this.processPermissionObject(upload);
    } else if (upload.type === 'CustomResourceExampleTemplate') {
      this.proccessCustomResourceExampleTemplate(upload.data);
    }

    return upload;
  };

  /**
   * Converts file content into separate objects after upload
   * @param {string} fileContent yaml string to parse
   * @param {string} fileName
   */
  splitUploadedFileToObjects = (fileContent, fileName) => {
    let parsedObjects = [];

    try {
      parsedObjects = safeLoadAll(fileContent);
    } catch (e) {
      return [utils.createErroredUpload(fileName, 'Parsing Errors')];
    }

    const uploads = parsedObjects.map(object => {
      const upload = utils.createtUpload(fileName);
      upload.data = object;

      return this.processUploadedObject(upload);
    });

    return uploads;
  };

  /**
   * Update package data from package file
   */
  processPackageFile = parsedFile => {
    const { operatorPackage, updateOperatorPackage, setSectionStatus } = this.props;
    const channel = parsedFile.channels && parsedFile.channels[0] ? parsedFile.channels[0] : null;

    const newPackage = {
      name: parsedFile.packageName,
      channel: channel ? channel.name : operatorPackage.channel
    };

    updateOperatorPackage(newPackage);

    const operatorPackageValid = validateOperatorPackage(newPackage);

    if (!operatorPackageValid) {
      setSectionStatus('package', EDITOR_STATUS.errors);
    } else {
      setSectionStatus('package', EDITOR_STATUS.pending);
    }
  };

  processCrdFile = parsedFile => {
    const { operator, storeEditorOperator } = this.props;
    /** @type {Operator} */
    const newOperator = _.cloneDeep(operator);

    const specDescriptors = Object.keys(
      _.get(parsedFile, 'spec.validation.openAPIV3Schema.properties.spec.properties', {})
    );
    const statusDescriptors = Object.keys(
      _.get(parsedFile, 'spec.validation.openAPIV3Schema.properties.status.properties', {})
    );
    const kind = _.get(parsedFile, 'spec.names.kind', '');

    /** @type {OperatorOwnedCrd} */
    const uploadedCrd = {
      name: _.get(parsedFile, 'metadata.name', ''),
      displayName: _.startCase(kind),
      kind,
      version: _.get(parsedFile, 'spec.version', ''),
      description: _.startCase(kind),
      resources: getDefaultOwnedCRDResources(),
      specDescriptors: specDescriptors.map(utils.generateDescriptorFromPath),
      statusDescriptors: statusDescriptors.map(utils.generateDescriptorFromPath)
    };
    // use kind as display name - user can customize it later on
    uploadedCrd.displayName = uploadedCrd.kind;

    /** @type {OperatorOwnedCrd[]} */
    const ownedCrds = _.get(newOperator, sectionsFields['owned-crds'], []);
    let crd = ownedCrds.find(owned => owned.kind === uploadedCrd.kind);
    const examples = _.get(operator, 'metadata.annotations.alm-examples');
    const crdTemplates = convertExampleYamlToObj(examples);
    let crdTemplate = crdTemplates.find(template => template.kind === uploadedCrd.kind);

    if (crd) {
      console.log('Found existing CRD. Not overriding it.');

      // override generated CRDs, but not complete ones
      // cover usage with CR example which creates placeholder CR
      if (crd.name === '') {
        const index = ownedCrds.findIndex(ownedCrd => ownedCrd === crd);
        ownedCrds[index] = _.merge({}, crd, uploadedCrd);
      }
    } else {
      crd = _.merge(getDefaultOnwedCRD(), uploadedCrd);

      // replace default crd example
      if (ownedCrds.length === 1 && isOwnedCrdDefault(ownedCrds[0])) {
        ownedCrds[0] = crd;
      } else {
        ownedCrds.push(crd);
      }
    }

    if (!crdTemplate) {
      crdTemplate = getDefaultAlmExample();
      crdTemplate.kind = uploadedCrd.kind;

      if (crdTemplates.length === 1 && isAlmExampleDefault(crdTemplates[0])) {
        crdTemplates[0] = crdTemplate;
      } else {
        crdTemplates.push(crdTemplate);
      }
    }

    _.set(newOperator, sectionsFields['owned-crds'], ownedCrds);
    _.set(newOperator, 'metadata.annotations.alm-examples', JSON.stringify(crdTemplates));

    this.validateSection(newOperator, 'owned-crds');
    storeEditorOperator(newOperator);
  };

  /**
   * Pre-process CSV file and store it redux
   * @param {*} parsedFile
   */
  processDeployment = parsedFile => {
    const { operator, storeEditorOperator } = this.props;
    const newOperator = _.cloneDeep(operator);
    let deployments = _.get(newOperator, sectionsFields.deployments, []);
    const name = _.get(parsedFile, 'metadata.name', `Deployment-${deployments.length + 1}`);

    if (parsedFile.spec) {
      // add name to deployment from operator. If none exists use empty
      const newDeployment = {
        name: _.get(newOperator, 'metadata.name') || name,
        spec: parsedFile.spec
      };

      // replace default deployment
      if (deployments.length === 1 && isDeploymentDefault(deployments[0])) {
        deployments = [newDeployment];
      } else {
        deployments.push(newDeployment);
      }

      // set new deployments
      _.set(newOperator, sectionsFields.deployments, deployments);

      this.validateSection(newOperator, 'deployments');
      storeEditorOperator(newOperator);
    } else {
      console.warn(`Deployment object is invalid as doesn't contain spec object`);
    }
  };

  /**
   * Checks latest permission related object and decide
   * if we have enough uploaded data to create from it permission record
   * @param {UploadMetadata} upload
   */
  processPermissionObject = upload => {
    const { uploads } = this.props;

    /** @type {UploadMetadata[]} uploadsWithRecent */
    const uploadsWithRecent = uploads.concat(upload);

    // ensure that obejcts share namespace
    const namespace = _.get(upload.data, 'metadata.name');

    if (!namespace) {
      console.log("Can't identify namespace for which to apply permissions!");
      return;
    }

    const serviceAccountUpload = utils.filterPermissionUploads(uploadsWithRecent, 'ServiceAccount', namespace);
    const roleUpload = utils.filterPermissionUploads(uploadsWithRecent, 'Role', namespace);
    const roleBindingUpload = utils.filterPermissionUploads(uploadsWithRecent, 'RoleBinding', namespace);
    const clusterRoleUpload = utils.filterPermissionUploads(uploadsWithRecent, 'ClusterRole', namespace);
    const clusterRoleBindingUpload = utils.filterPermissionUploads(uploadsWithRecent, 'ClusterRoleBinding', namespace);

    // hurray we have all we need
    if (serviceAccountUpload) {
      if (roleUpload && roleBindingUpload) {
        this.setPermissions(roleUpload.data, roleBindingUpload.data);
      }

      if (clusterRoleUpload && clusterRoleBindingUpload) {
        this.setPermissions(clusterRoleUpload.data, clusterRoleBindingUpload.data);
      }

      console.log('Processed role / cluster role into permissions');
    } else {
      console.log('No ServiceAccount yet. Waiting');
    }
  };

  /**
   * Set permissions from collected kubernets objects
   * @param {KubernetesRoleObject} roleObject
   * @param {KubernetsRoleBindingObject} roleBindingObject
   */
  setPermissions = (roleObject, roleBindingObject) => {
    const { operator, storeEditorOperator } = this.props;
    const newOperator = _.cloneDeep(operator);

    const { roleRef } = roleBindingObject;
    const subjects = roleBindingObject.subjects || [];
    let serviceAccounts = subjects.filter(subject => subject.kind === 'ServiceAccount');

    if (roleRef && roleRef.name) {
      serviceAccounts = serviceAccounts.filter(account => account.name === roleRef.name);

      if (subjects.length !== serviceAccounts.length) {
        console.log(
          'Some role binding subject were removed as do not match namespace or are not kind of ServiceAccount',
          roleBindingObject
        );
      }

      const roleName = _.get(roleObject, 'metadata.name');
      const { rules } = roleObject;

      // check namespace to be sure we have correct roles
      if (roleName === roleRef.name) {
        const permission = {
          serviceAccountName: roleName,
          rules
        };

        // define where to add permission based on kind
        const permissionType = roleObject.kind === 'Role' ? 'permissions' : 'cluster-permissions';

        // update operator with added permission
        const newPermissions = _.get(newOperator, sectionsFields[permissionType], []);
        newPermissions.push(permission);
        _.set(newOperator, sectionsFields[permissionType], newPermissions);

        this.validateSection(newOperator, permissionType);

        storeEditorOperator(newOperator);
      } else {
        console.warn("Can't match role namespace with one defined in role binding.");
      }
    } else {
      console.warn(`Role binding does not contain "roleRef" or it does not have name!`, roleBindingObject);
    }
  };

  /**
   * Pre-process CSV file and store it redux
   * @param {*} parsedFile
   */
  processCsvFile = parsedFile => {
    const { operator, storeEditorOperator } = this.props;

    const normalizedOperator = normalizeYamlOperator(parsedFile);
    const clonedOperator = _.cloneDeep(operator);

    // only CSV.yaml is used to populate operator in editor. Other files have special roles
    const mergedOperator = _.mergeWith(clonedOperator, normalizedOperator, (objValue, srcValue, key) => {
      // handle owned CRDs
      switch (key) {
        // merge owned CRDs by kind
        case 'owned':
          return utils.mergeOwnedCRDs(objValue, srcValue);
        // merge requried CRDs by kind
        case 'required':
          return utils.mergeArrayOfObjectsByKey(objValue, srcValue, 'kind');
        case 'alm-examples':
          return utils.mergeAlmExamples(objValue, srcValue);
        // replace deployments instead of merging
        case 'deployments':
          return utils.mergeDeployments(objValue, srcValue);
        // merge permissions using serviceAccountName as unique ID
        case 'permissions':
        case 'clusterPermissions':
          return utils.mergeArrayOfObjectsByKey(objValue, srcValue, 'serviceAccountName');

        default:
          return undefined;
      }
    });

    this.compareSections(operator, mergedOperator, normalizedOperator);
    storeEditorOperator(mergedOperator);
  };

  /**
   * Proccess uploaded custom resource example file into ALM examples
   * @param {*} parsedFile
   */
  proccessCustomResourceExampleTemplate = parsedFile => {
    const { operator, storeEditorOperator } = this.props;
    const newOperator = _.cloneDeep(operator);

    const almExamples = _.get(newOperator, 'metadata.annotations.alm-examples', []);
    const crdExamples = convertExampleYamlToObj(almExamples);

    const exampleIndex = crdExamples.findIndex(example => example.kind === parsedFile.kind);

    if (exampleIndex === -1) {
      // override default template
      if (crdExamples.length === 1 && isAlmExampleDefault(crdExamples[0])) {
        crdExamples[0] = parsedFile;
      } else {
        crdExamples.push(parsedFile);
      }
    } else {
      crdExamples[exampleIndex] = _.merge({}, crdExamples[exampleIndex], parsedFile);
    }

    const ownedCrds = _.get(newOperator, sectionsFields['owned-crds'], []);
    const crdIndex = ownedCrds.findIndex(ownedCrd => ownedCrd.kind === parsedFile.kind);

    // create dummy CRD with example so we pair them correctly
    if (crdIndex === -1) {
      const crd = getDefaultOnwedCRD();
      crd.kind = parsedFile.kind;
      crd.name = '';
      crd.displayName = parsedFile.kind;

      // replace example CRD with newly created one
      if (ownedCrds.length === 1 && isOwnedCrdDefault(ownedCrds[0])) {
        ownedCrds[0] = crd;
      } else {
        ownedCrds.push(crd);
      }
    }

    _.set(newOperator, 'metadata.annotations.alm-examples', JSON.stringify(crdExamples));
    _.set(newOperator, sectionsFields['owned-crds'], ownedCrds);

    this.validateSection(newOperator, 'owned-crds');
    storeEditorOperator(newOperator);
  };

  /**
   * Check defined editor sections and mark them for review if are affected by upload
   * @param {Operator} operator operator state before upload
   * @param {Operator} merged operator state after upload is applied
   * @param {Operator} uploaded actual uploaded operator
   */
  compareSections = (operator, merged, uploaded) => {
    const { setAllSectionsStatusAction } = this.props;

    const updatedSectionsStatus = {};

    Object.keys(sectionsFields).forEach(sectionName => {
      const fields = sectionsFields[sectionName];
      let updated = false;

      // check if operator fields are same as before upload
      if (typeof fields === 'string') {
        updated = utils.operatorFieldWasUpdated(fields, operator, uploaded, merged);
      } else {
        updated = fields.some(path => utils.operatorFieldWasUpdated(path, operator, uploaded, merged));
      }

      if (updated) {
        const sectionErrors = getUpdatedFormErrors(merged, {}, fields);

        // check if some section field has error
        if (_.castArray(fields).some(field => _.get(sectionErrors, field))) {
          updatedSectionsStatus[sectionName] = EDITOR_STATUS.errors;
        } else {
          updatedSectionsStatus[sectionName] = EDITOR_STATUS.pending;
        }
      }
    });

    if (Object.keys(updatedSectionsStatus).length > 0) {
      // section has errors / missing content so draw attention
      setAllSectionsStatusAction(updatedSectionsStatus);
    }
  };

  /**
   * Validates section and updates errors
   * @param {Operator} operator
   * @param {EditorSectionNames} sectionName
   */
  validateSection = (operator, sectionName) => {
    const { setSectionStatus } = this.props;
    const fields = sectionsFields[sectionName];

    const sectionErrors = getUpdatedFormErrors(operator, {}, fields);

    // check if some section field has error
    const sectionHasErrors = _.castArray(fields).some(field => _.get(sectionErrors, field));

    if (sectionHasErrors) {
      // section has errors / missing content so draw attention
      setSectionStatus(sectionName, EDITOR_STATUS.errors);
    } else {
      // mark section as review needed
      setSectionStatus(sectionName, EDITOR_STATUS.pending);
    }
  };

  /**
   * Handle upload using URL dialog
   */
  doUploadUrl = (contents, url) => {
    const { uploads, setUploads } = this.props;

    const recentUploads = this.splitUploadedFileToObjects(contents, url);

    this.setState({ uploadUrlShown: false });

    const newUploads = utils.markReplacedObjects([...uploads, ...recentUploads]);

    setUploads(newUploads);
  };

  /**
   * Handle direct multi-file upload using file uploader or drag and drop
   */
  doUploadFiles = files => {
    if (!files) {
      return;
    }
    let fileIndex = 0;
    let fileToUpload = files.item(0);

    while (fileToUpload) {
      this.readFile(fileToUpload);

      fileToUpload = files.item(++fileIndex);
    }
  };

  /**
   * Read file if its valid and pass it for processing
   */
  readFile = fileToUpload => {
    const isValidFileType = validFileTypesRegExp.test(fileToUpload.name);

    if (isValidFileType) {
      const reader = new FileReader();

      reader.onload = () => {
        const { uploads, setUploads } = this.props;

        const upload = this.splitUploadedFileToObjects(reader.result, fileToUpload.name);
        const newUploads = utils.markReplacedObjects([...uploads, ...upload]);

        setUploads(newUploads);
      };

      reader.onerror = () => {
        const { uploads, setUploads } = this.props;

        const upload = utils.createErroredUpload(fileToUpload.name, reader.error.message);

        // skip finding replaced files as this file errored

        setUploads([...uploads, upload]);

        reader.abort();
      };
      reader.readAsText(fileToUpload);
    } else {
      this.props.showErrorModal(`Unable to upload file '${fileToUpload.name}': Only yaml files are supported`);
    }
  };

  /**
   * Remove all uploaded files from the list
   */
  removeAllUploads = e => {
    const { setUploads } = this.props;

    e.preventDefault();
    setUploads([]);
  };

  /**
   * Remove specific upload by its index
   * @param {*} e
   * @param {number} id index (id) of the upload to remove
   */
  removeUpload = (e, id) => {
    const { uploads, setUploads } = this.props;

    e.preventDefault();

    // reset overwritten state of uploads and determine new
    let newUploads = uploads
      .filter(upload => upload.id !== id)
      .map(upload => ({
        ...upload,
        overwritten: false
      }));
    newUploads = utils.markReplacedObjects(newUploads);

    setUploads(newUploads);
  };

  showUploadUrl = e => {
    e.preventDefault();
    this.setState({ uploadUrlShown: true });
  };

  hideUploadUrl = () => {
    this.setState({ uploadUrlShown: false });
  };

  /**
   * Exapnd / collapse uploader and file list
   */
  toggleUploadExpanded = event => {
    const { uploadExpanded } = this.state;

    event.preventDefault();
    this.setState({ uploadExpanded: !uploadExpanded });
  };

  render() {
    const { uploads, operator } = this.props;
    const { uploadUrlShown, uploadExpanded } = this.state;
    const missingCrds = getMissingCrdUploads(uploads, operator);

    return (
      <div id="manifest-uploader" className="oh-operator-editor-page__section">
        <div className="oh-operator-editor-page__section__header">
          <div className="oh-operator-editor-page__section__header__text">
            <h2 id="oh-operator--editor-page__manifest-uploader">Upload your Kubernetes manifests</h2>
            <p>
              Upload your existing YAML manifests of your Operators deployment. We support <code>Deployments</code>,
              <code>(Cluster)Roles</code>, <code>(Cluster)RoleBindings</code>, <code>ServiceAccounts</code> and{' '}
              <code>CustomResourceDefinition</code> objects. The information from these objects will be used to populate
              your Operator metadata. Alternatively, you can also upload an existing CSV.
              <br />
              <br />
              <b>Note:</b> For a complete bundle the CRDs manifests are required.
            </p>
          </div>
          <div className="oh-operator-editor-page__section__status">
            {uploadExpanded ? (
              <a onClick={this.toggleUploadExpanded}>
                <Icon type="fa" name="compress" />
                Collapse
              </a>
            ) : (
              <a onClick={this.toggleUploadExpanded}>
                <Icon type="fa" name="expand" />
                Expand
              </a>
            )}
          </div>
        </div>
        {uploadExpanded && (
          <React.Fragment>
            <UploaderDropArea showUploadUrl={this.showUploadUrl} doUploadFile={this.doUploadFiles} />
            <UploaderObjectList
              uploads={uploads}
              missingUploads={missingCrds}
              removeUpload={this.removeUpload}
              removeAllUploads={this.removeAllUploads}
            />
            <UploadUrlModal show={uploadUrlShown} onUpload={this.doUploadUrl} onClose={this.hideUploadUrl} />
          </React.Fragment>
        )}
      </div>
    );
  }
}

ManifestUploader.propTypes = {
  operator: PropTypes.object,
  operatorPackage: PropTypes.object,
  uploads: PropTypes.array,
  showErrorModal: PropTypes.func,
  setSectionStatus: PropTypes.func,
  setAllSectionsStatusAction: PropTypes.func,
  updateOperatorPackage: PropTypes.func,
  setUploads: PropTypes.func,
  storeEditorOperator: PropTypes.func
};

ManifestUploader.defaultProps = {
  operator: {},
  operatorPackage: {},
  uploads: [],
  showErrorModal: helpers.noop,
  setSectionStatus: helpers.noop,
  setAllSectionsStatusAction: helpers.noop,
  updateOperatorPackage: helpers.noop,
  setUploads: helpers.noop,
  storeEditorOperator: helpers.noop
};

const mapDispatchToProps = dispatch => ({
  ...bindActionCreators(
    {
      showErrorModal: error => ({
        type: reduxConstants.CONFIRMATION_MODAL_SHOW,
        title: 'Error Uploading File',
        icon: <Icon type="pf" name="error-circle-o" />,
        heading: error,
        confirmButtonText: 'OK'
      }),
      setSectionStatus: actions.setSectionStatusAction,
      setAllSectionsStatusAction: actions.setBatchSectionsStatusAction,
      updateOperatorPackage: actions.updateOperatorPackageAction,
      setUploads: actions.setUploadsAction,
      storeEditorOperator: actions.storeEditorOperatorAction
    },
    dispatch
  )
});

const mapStateToProps = state => ({
  operator: state.editorState.operator,
  operatorPackage: state.editorState.operatorPackage,
  uploads: state.editorState.uploads
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ManifestUploader);
