import * as React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as _ from 'lodash-es';

import { helpers } from '../../common/helpers';
import { categoryOptions, maturityOptions, operatorFieldPlaceholders } from '../../utils/operatorDescriptors';
import CapabilityEditor from '../../components/editor/CapabilityEditor';
import LabelsEditor from '../../components/editor/LabelsEditor';
import ImageEditor from '../../components/editor/ImageEditor';
import { getUpdatedFormErrors, EDITOR_STATUS, sectionsFields } from './bundlePageUtils';
import OperatorEditorSubPage from './OperatorEditorSubPage';
import DescriptionEditor from '../../components/editor/DescriptionEditor';
import EditorSelect from '../../components/editor/EditorSelect';
import {
  setSectionStatusAction,
  storeEditorFormErrorsAction,
  storeEditorOperatorAction
} from '../../redux/actions/editorActions';
import OperatorInput from '../../components/editor/forms/OperatorInput';
import { renderOperatorFormField } from '../../components/editor/forms/OtherFields';

const metadataDescription = `
  The metadata section contains general metadata around the name, version, and other info that aids users in the
  discovery of your Operator.
  `;

class OperatorMetadataPage extends React.Component {
  /**
   * @type {Object}
   */
  state = {
    workingOperator: {}
  };

  constructor(props) {
    super(props);

    this.state = { workingOperator: _.cloneDeep(props.operator) };
  }

  componentDidUpdate(prevProps) {
    const { operator } = this.props;

    if (!_.isEqual(operator, prevProps.operator)) {
      this.setState({ workingOperator: _.cloneDeep(operator) });
    }
  }

  componentDidMount() {
    const { sectionStatus, formErrors, storeEditorFormErrors } = this.props;
    const { workingOperator } = this.state;

    this.originalStatus = sectionStatus.metadata;
    if (this.originalStatus !== EDITOR_STATUS.empty) {
      const errors = getUpdatedFormErrors(workingOperator, formErrors, sectionsFields.metadata);
      storeEditorFormErrors(errors);
    }
  }

  updateOperator = (value, field) => {
    const { workingOperator } = this.state;
    _.set(workingOperator, field, value);
    this.forceUpdate();
  };

  validateFields = fields => {
    const { storeEditorOperator, formErrors, storeEditorFormErrors, setSectionStatus } = this.props;
    const { workingOperator } = this.state;

    const errors = getUpdatedFormErrors(workingOperator, formErrors, fields);
    storeEditorFormErrors(errors);
    const metadataErrors = _.some(sectionsFields.metadata, metadataField => _.get(errors, metadataField));

    console.dir(errors);
    storeEditorOperator(_.cloneDeep(workingOperator));

    if (metadataErrors) {
      setSectionStatus(EDITOR_STATUS.errors);
    } else {
      setSectionStatus(EDITOR_STATUS.pending);
    }
  };

  validatePage = () => {
    const { operator, formErrors, setSectionStatus, storeEditorFormErrors } = this.props;

    const fields = sectionsFields.metadata;
    const errors = getUpdatedFormErrors(operator, formErrors, fields);
    const metadataErrors = fields.some(field => _.get(errors, field));

    if (metadataErrors) {
      this.originalStatus = EDITOR_STATUS.errors;
      setSectionStatus(EDITOR_STATUS.errors);
      storeEditorFormErrors(errors);

      return false;
    }

    return true;
  };

  updateOperatorImage = icon => {
    this.updateOperator(icon, 'spec.icon');
    this.validateFields('spec.icon');
  };

  updateOperatorCapability = capability => {
    this.updateOperator(capability, 'metadata.annotations.capabilities');
    this.validateFields('metadata.annotations.capabilities');
  };

  updateOperatorLabels = operatorLabels => {
    const labels = {};

    _.forEach(operatorLabels, operatorLabel => {
      if (!_.isEmpty(operatorLabel.key) || !_.isEmpty(operatorLabel.value)) {
        _.set(labels, operatorLabel.key, operatorLabel.value);
      }
    });
    this.updateOperator(labels, 'spec.labels');
    this.validateFields('spec.labels');
  };

  updateOperatorSelectors = operatorLabels => {
    const matchLabels = {};

    _.forEach(operatorLabels, operatorLabel => {
      if (!_.isEmpty(operatorLabel.key) || !_.isEmpty(operatorLabel.value)) {
        _.set(matchLabels, operatorLabel.key, operatorLabel.value);
      }
    });
    this.updateOperator(matchLabels, 'spec.selector.matchLabels');
    this.validateFields('spec.selector.matchLabels');
  };

  updateOperatorExternalLinks = operatorLabels => {
    const links = [];

    _.forEach(operatorLabels, operatorLabel => {
      if (!_.isEmpty(operatorLabel.name) && !_.isEmpty(operatorLabel.url)) {
        links.push(_.clone(operatorLabel));
      }
    });

    this.updateOperator(links, 'spec.links');
    this.validateFields('spec.links');
  };

  updateOperatorMaintainers = operatorLabels => {
    const maintainers = [];

    _.forEach(operatorLabels, operatorLabel => {
      if (!_.isEmpty(operatorLabel.name) && !_.isEmpty(operatorLabel.email)) {
        maintainers.push(_.clone(operatorLabel));
      }
    });

    this.updateOperator(maintainers, 'spec.maintainers');
    this.validateFields(['spec.maintainers', 'spec.provider.name']);
  };

  renderFormField = (title, field, fieldType) => {
    const { operator, formErrors } = this.props;
    const { workingOperator } = this.state;

    const errs = this.originalStatus === EDITOR_STATUS.empty && _.get(operator, field) === undefined ? {} : formErrors;

    return renderOperatorFormField(
      workingOperator,
      errs,
      this.updateOperator,
      this.validateFields,
      title,
      field,
      fieldType
    );
  };
  renderProviderName = () => {
    const { operator, formErrors } = this.props;
    const { workingOperator } = this.state;
    const field = 'spec.provider.name';

    const errs = this.originalStatus === EDITOR_STATUS.empty && _.get(operator, field) === undefined ? {} : formErrors;

    return renderOperatorFormField(
      workingOperator,
      errs,
      this.updateOperator,
      () => {
        // validate both fields as they are interconnected
        this.validateFields(['spec.maintainers', 'spec.provider.name']);
      },
      'Provider Name',
      field,
      'text'
    );
  };

  renderMaturity = () => {
    const { formErrors } = this.props;
    const { workingOperator } = this.state;
    const field = 'spec.maturity';

    const maturity = _.get(workingOperator, field);
    const values = maturity ? [maturity] : [];

    return (
      <OperatorInput title="Maturity" field={field} formErrors={formErrors}>
        <EditorSelect
          id={_.camelCase(field)}
          values={values}
          isMulti={false}
          noClear
          options={maturityOptions}
          placeholder={_.get(operatorFieldPlaceholders, field, `Select maturity`)}
          onChange={selection => {
            this.updateOperator(selection[0], field);
          }}
          onBlur={() => this.validateFields(field)}
          filterBy={() => true}
        />
      </OperatorInput>
    );
  };

  renderCategories = () => {
    const { formErrors } = this.props;
    const { workingOperator } = this.state;
    const field = 'metadata.annotations.categories';

    const categories = _.get(workingOperator, field);
    const values = categories ? _.split(categories, ',') : [];

    return (
      <OperatorInput title="Categories" field={field} formErrors={formErrors}>
        <EditorSelect
          id={_.camelCase(field)}
          values={values}
          isMulti
          clearButton
          options={categoryOptions}
          placeholder={_.get(operatorFieldPlaceholders, field, `Select Categories`)}
          onChange={selections => {
            this.updateOperator(_.join(selections, ', '), field);
          }}
          onBlur={() => this.validateFields(field)}
        />
      </OperatorInput>
    );
  };

  renderKeywords = () => {
    const { formErrors } = this.props;
    const { workingOperator } = this.state;
    const field = 'spec.keywords';

    return (
      <OperatorInput title="Keywords" field={field} formErrors={formErrors}>
        <EditorSelect
          id={_.camelCase(field)}
          values={_.get(workingOperator, field)}
          isMulti
          clearButton
          customSelect
          placeholder={_.get(operatorFieldPlaceholders, field, `Add Keywords`)}
          onChange={selections => {
            this.updateOperator(selections, field);
          }}
          onBlur={() => this.validateFields(field)}
          newSelectionPrefix="Add keyword:"
          emptyLabel="Add keyword:"
        />
      </OperatorInput>
    );
  };

  renderMetadataFields = () => {
    const { formErrors } = this.props;
    const { workingOperator } = this.state;

    return (
      <form className="oh-operator-editor-form">
        {this.renderFormField('Name', 'metadata.name', 'text')}
        {this.renderFormField('Display Name', 'spec.displayName', 'text')}
        {this.renderFormField('Short Description', 'metadata.annotations.description', 'text-area')}
        {this.renderMaturity()}
        {this.renderFormField('Version', 'spec.version', 'text')}
        {this.renderFormField('Replaces (optional)', 'spec.replaces', 'text')}
        {this.renderFormField('Minimum Kubernetes Version (optional)', 'spec.minKubeVersion', 'text')}
        <DescriptionEditor
          operator={workingOperator}
          onUpdate={this.updateOperator}
          onValidate={this.validateFields}
          formErrors={formErrors}
        />
        <CapabilityEditor operator={workingOperator} onUpdate={this.updateOperatorCapability} />
        <LabelsEditor
          operator={workingOperator}
          onUpdate={this.updateOperatorLabels}
          title="Labels"
          singular="Label"
          field="spec.labels"
          isPropsField
          formErrors={formErrors}
        />
        <LabelsEditor
          operator={workingOperator}
          onUpdate={this.updateOperatorSelectors}
          title="Selectors"
          singular="Selector"
          field="spec.selector.matchLabels"
          isPropsField
          formErrors={formErrors}
        />
        <h3>Categories and Keywords</h3>
        {this.renderCategories()}
        {this.renderKeywords()}
        <h3>Image Assets</h3>
        <ImageEditor onUpdate={this.updateOperatorImage} icon={_.get(workingOperator, 'spec.icon', [])[0]} />
        <LabelsEditor
          operator={workingOperator}
          onUpdate={this.updateOperatorExternalLinks}
          title="External Links"
          singular="External Link"
          field="spec.links"
          keyField="name"
          keyLabel="Name"
          keyPlaceholder="e.g. Blog"
          valueField="url"
          valueLabel="URL"
          valuePlaceholder="e.g. https://coreos.com/etcd"
          formErrors={formErrors}
        />
        <h3>Contact Information</h3>
        {this.renderProviderName()}
        <LabelsEditor
          operator={workingOperator}
          onUpdate={this.updateOperatorMaintainers}
          title="Maintainers"
          singular="Maintainer"
          field="spec.maintainers"
          keyField="name"
          keyLabel="Name"
          keyPlaceholder="e.g. support"
          valueField="email"
          valueLabel="Email"
          valuePlaceholder="e.g. support@example.com"
          formErrors={formErrors}
        />
      </form>
    );
  };

  render() {
    const { formErrors, operator, history, sectionStatus } = this.props;

    const metadataErrorFields = sectionsFields.metadata.filter(metadataField => _.get(formErrors, metadataField));
    // mark pristine page
    const pageErrors =
      sectionStatus.metadata === EDITOR_STATUS.empty ||
      metadataErrorFields.some(errorField => _.get(operator, errorField) !== undefined);

    return (
      <OperatorEditorSubPage
        title="Operator Metadata"
        description={metadataDescription}
        secondary
        history={history}
        section="metadata"
        pageErrors={pageErrors}
        validatePage={this.validatePage}
      >
        {this.renderMetadataFields()}
      </OperatorEditorSubPage>
    );
  }
}

OperatorMetadataPage.propTypes = {
  operator: PropTypes.object,
  formErrors: PropTypes.object,
  sectionStatus: PropTypes.object,
  setSectionStatus: PropTypes.func,
  storeEditorOperator: PropTypes.func,
  storeEditorFormErrors: PropTypes.func,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired
  }).isRequired
};

OperatorMetadataPage.defaultProps = {
  operator: {},
  formErrors: {},
  sectionStatus: {},
  setSectionStatus: helpers.noop,
  storeEditorFormErrors: helpers.noop,
  storeEditorOperator: helpers.noop
};

const mapDispatchToProps = dispatch => ({
  ...bindActionCreators(
    {
      storeEditorOperator: storeEditorOperatorAction,
      storeEditorFormErrors: storeEditorFormErrorsAction,
      setSectionStatus: status => setSectionStatusAction('metadata', status)
    },
    dispatch
  )
});

const mapStateToProps = state => ({
  operator: state.editorState.operator,
  formErrors: state.editorState.formErrors,
  sectionStatus: state.editorState.sectionStatus
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(OperatorMetadataPage);
