import React from 'react';

interface StudioStepperProps {
  step: number;
  setStep: (step: number) => void;
  clipsCount: number;
  selectedClipsCount: number;
}

export const StudioStepper: React.FC<StudioStepperProps> = ({
  step,
  setStep,
  clipsCount,
  selectedClipsCount,
}) => {
  return (
    <div className="wizard-stepper">
      <div
        className={`wizard-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}
        onClick={() => setStep(1)}
      >
        <span className="wizard-step-num">1</span>
        <div className="wizard-step-info">
          <span className="wizard-step-title">Pilih Video</span>
          <span className="wizard-step-desc">URL &amp; Parameter</span>
        </div>
      </div>

      <div
        className={`wizard-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}
        onClick={() => setStep(2)}
      >
        <span className="wizard-step-num">2</span>
        <div className="wizard-step-info">
          <span className="wizard-step-title">Klip Rekomendasi AI</span>
          <span className="wizard-step-desc">
            {clipsCount > 0
              ? selectedClipsCount > 0
                ? `${selectedClipsCount}/${clipsCount} Dipilih`
                : `${clipsCount} Klip Siap`
              : 'Analisis Skor'}
          </span>
        </div>
      </div>

      <div
        className={`wizard-step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}
        onClick={() => setStep(3)}
      >
        <span className="wizard-step-num">3</span>
        <div className="wizard-step-info">
          <span className="wizard-step-title">Gaya &amp; Subtitle</span>
          <span className="wizard-step-desc">Template &amp; B-Roll</span>
        </div>
      </div>

      <div
        className={`wizard-step ${step === 4 ? 'active' : step > 4 ? 'completed' : ''}`}
        onClick={() => setStep(4)}
      >
        <span className="wizard-step-num">4</span>
        <div className="wizard-step-info">
          <span className="wizard-step-title">Hasil &amp; Unduh</span>
          <span className="wizard-step-desc">Video 1080x1920</span>
        </div>
      </div>
    </div>
  );
};
