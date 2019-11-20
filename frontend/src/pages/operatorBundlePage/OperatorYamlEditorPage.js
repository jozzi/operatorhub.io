import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { noop } from '../../common/helpers';
import YamlViewer from '../../components/YamlViewer';
import { parseYamlOperator, yamlFromOperator } from './bundlePageUtils';
import OperatorEditorSubPage from './subPage/OperatorEditorSubPage';
import PreviewOperatorModal from '../../components/modals/PreviewOperatorModal';
import { isDefaultOperator } from '../../utils/operatorUtils';
import { resetEditorOperatorAction, storeEditorOperatorAction } from '../../redux/actions/editorActions';
import { hideConfirmModalAction, showClearConfirmationModalAction } from '../../redux';

class OperatorYamlEditorPage extends React.Component {
  state = {
    yaml: '',
    yamlError: null,
    previewShown: false
  };

  componentDidMount() {
    const { operator } = this.props;
    this.updateYaml(operator);
  }

  backToPackageYourOperator = e => {
    e.preventDefault();
    this.props.history.push('/bundle');
  };

  hidePreviewOperator = () => {
    this.setState({ previewShown: false });
  };

  showPreviewOperator = () => {
    this.setState({ previewShown: true });
  };

  doClearContents = () => {
    const { resetEditorOperator, hideConfirmModal } = this.props;
    resetEditorOperator();
    hideConfirmModal();
  };

  clearContents = () => {
    const { showConfirmModal } = this.props;
    showConfirmModal(this.doClearContents);
  };

  updateYaml = operator => {
    let yaml;
    let yamlError = null;
    try {
      yaml = yamlFromOperator(operator);
    } catch (e) {
      yamlError = e;
    }

    this.setState({ yaml, yamlError });
  };

  onYamlChange = yaml => {
    const { storeEditorOperator } = this.props;

    let yamlError;
    try {
      const updatedOperator = parseYamlOperator(yaml);
      yamlError = '';
      storeEditorOperator(updatedOperator);
    } catch (e) {
      yamlError = e.message;
    }
    this.setState({ yamlError });
  };

  renderHeader = () => (
    <div className="oh-operator-editor-page__header">
      <h1>Edit your Cluster Service Version (CSV) YAML for your Operator</h1>
    </div>
  );

  renderButtonBar() {
    const { operator } = this.props;
    const { yamlError } = this.state;

    const isDefault = isDefaultOperator(operator);

    const previewClasses = classNames('oh-button oh-button-secondary', { disabled: yamlError });
    const clearClasses = classNames('oh-button oh-button-secondary', { disabled: isDefault });

    return (
      <div className="oh-operator-editor-page__button-bar">
        <div>
          <button className="oh-button oh-button-secondary" onClick={this.backToPackageYourOperator}>
            Back to Package your Operator
          </button>
          <button className={previewClasses} disabled={yamlError} onClick={this.showPreviewOperator}>
            Preview
          </button>
        </div>
        <button className={clearClasses} disabled={isDefault} onClick={this.clearContents}>
          Clear Content
        </button>
      </div>
    );
  }

  render() {
    const { history, operator } = this.props;
    const { yaml, yamlError, previewShown } = this.state;

    return (
      <OperatorEditorSubPage
        title="YAML Editor"
        header={this.renderHeader()}
        buttonBar={this.renderButtonBar()}
        history={history}
      >
        <YamlViewer
          onBlur={updatedYaml => this.onYamlChange(updatedYaml)}
          editable
          yaml={yaml}
          error={yamlError}
          allowClear={false}
        />
        <PreviewOperatorModal show={previewShown} yamlOperator={operator} onClose={this.hidePreviewOperator} />
      </OperatorEditorSubPage>
    );
  }
}

OperatorYamlEditorPage.propTypes = {
  operator: PropTypes.object,
  storeEditorOperator: PropTypes.func,
  resetEditorOperator: PropTypes.func,
  showConfirmModal: PropTypes.func,
  hideConfirmModal: PropTypes.func,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired
  }).isRequired
};

OperatorYamlEditorPage.defaultProps = {
  operator: {},
  storeEditorOperator: noop,
  resetEditorOperator: noop,
  showConfirmModal: noop,
  hideConfirmModal: noop
};

const mapDispatchToProps = dispatch => ({
  ...bindActionCreators(
    {
      storeEditorOperator: storeEditorOperatorAction,
      resetEditorOperator: resetEditorOperatorAction,
      showConfirmModal: showClearConfirmationModalAction,
      hideConfirmModal: hideConfirmModalAction
    },
    dispatch
  )
});

const mapStateToProps = state => ({
  operator: state.editorState.operator
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(OperatorYamlEditorPage);
