// This file re-exports the modular coverage-editor component for backward compatibility
// and simpler migration path for existing code that uses CoverageEditor

import { CoverageEditor as ModularCoverageEditor } from './coverage-editor';
import { DailyCoverage, StoreConfigProps } from './coverage-editor/types';

interface CoverageEditorProps {
    initialCoverage?: DailyCoverage[];
    storeConfig: StoreConfigProps;
    onChange?: (coverage: DailyCoverage[]) => void;
}

export const CoverageEditor = (props: CoverageEditorProps) => {
    return (
        <ModularCoverageEditor
            initialCoverage={props.initialCoverage}
            storeConfig={props.storeConfig}
            onChange={props.onChange}
        />
    );
}; 