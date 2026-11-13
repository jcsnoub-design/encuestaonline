document.addEventListener('DOMContentLoaded', () => {
  // Endpoint del backend seguro (los tokens y webhooks residen de forma privada en el servidor)
  const API_ENDPOINT = '/api/encuesta';

  const form = document.getElementById('survey-form');
  const modal = document.getElementById('success-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const responseSummary = document.getElementById('response-summary');
  const submitBtn = document.getElementById('submit-btn');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnText = document.getElementById('btn-text');
  const btnIcon = document.getElementById('btn-icon');
  const formAlert = document.getElementById('form-alert');

  let currentResponse = null;

  // Validación básica del entorno de ejecución
  if (window.location.protocol === 'file:') {
    console.warn('⚠️ La página fue abierta como archivo local (file://). Para conectar con el servidor seguro ejecuta "npm start" y visita http://localhost:3000');
  }

  // Limpiar mensajes de error dinámicamente al interactuar
  const inputs = form.querySelectorAll('input, textarea');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      clearFieldError(input.name);
      hideAlert();
    });
    input.addEventListener('change', () => {
      clearFieldError(input.name);
      hideAlert();
    });
  });

  function clearFieldError(fieldName) {
    const errorEl = document.getElementById(`error-${fieldName}`);
    if (errorEl) {
      errorEl.textContent = '';
    }

    const fieldGroup = document.getElementById(`group-${fieldName}`) || 
                       form.querySelector(`[name="${fieldName}"]`)?.closest('.form-group');
    if (fieldGroup) {
      fieldGroup.classList.remove('has-error');
    }
  }

  function showFieldError(fieldName, message) {
    const errorEl = document.getElementById(`error-${fieldName}`);
    if (errorEl) {
      errorEl.textContent = message;
    }

    const fieldGroup = document.getElementById(`group-${fieldName}`) || 
                       form.querySelector(`[name="${fieldName}"]`)?.closest('.form-group');
    if (fieldGroup) {
      fieldGroup.classList.add('has-error');
    }
  }

  function showAlert(message) {
    if (formAlert) {
      formAlert.textContent = message;
      formAlert.classList.remove('hidden');
    }
  }

  function hideAlert() {
    if (formAlert) {
      formAlert.classList.add('hidden');
      formAlert.textContent = '';
    }
  }

  function setSubmittingState(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    if (isSubmitting) {
      btnSpinner.classList.remove('hidden');
      btnIcon.classList.add('hidden');
      btnText.textContent = 'Enviando respuestas...';
    } else {
      btnSpinner.classList.add('hidden');
      btnIcon.classList.remove('hidden');
      btnText.textContent = 'Enviar Encuesta';
    }
  }

  // Validación del formulario en el cliente
  function validateForm(formData) {
    let isValid = true;

    // 1. Validar ID Estudiante
    const idEstudiante = formData.get('id_estudiante')?.trim();
    if (!idEstudiante) {
      showFieldError('id_estudiante', 'Por favor ingresa tu identificador de estudiante.');
      isValid = false;
    } else if (idEstudiante.length > 60) {
      showFieldError('id_estudiante', 'El identificador no debe superar los 60 caracteres.');
      isValid = false;
    }

    // 2. Validar Nivel de Satisfacción
    const nivelSatisfaccion = formData.get('nivel_satisfaccion');
    if (!nivelSatisfaccion) {
      showFieldError('nivel_satisfaccion', 'Selecciona una calificación del 1 al 5.');
      isValid = false;
    }

    // 3. Validar Claridad del Contenido
    const claridadContenido = formData.get('claridad_contenido');
    if (!claridadContenido) {
      showFieldError('claridad_contenido', 'Selecciona una calificación del 1 al 5.');
      isValid = false;
    }

    // 4. Validar Aplicabilidad Práctica
    const aplicabilidadPractica = formData.get('aplicabilidad_practica');
    if (!aplicabilidadPractica) {
      showFieldError('aplicabilidad_practica', 'Selecciona una calificación del 1 al 5.');
      isValid = false;
    }

    return isValid;
  }

  // Enviar encuesta al backend seguro (Proxy que gestiona Airtable y n8n sin exponer claves)
  async function submitSurvey(data) {
    if (window.location.protocol === 'file:') {
      throw new Error('Debes iniciar el servidor con "npm start" y acceder desde http://localhost:3000 para enviar la encuesta de forma segura.');
    }

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Error en el servidor (${response.status})`);
    }

    return result;
  }

  // Renderizar resumen en el modal
  function renderSummary(data) {
    const formatScale = (val, minDesc, maxDesc) => {
      return `${val}/5 <span style="color:#64748b; font-size:0.8rem">(${val === '1' ? minDesc : val === '5' ? maxDesc : 'Puntaje ' + val})</span>`;
    };

    responseSummary.innerHTML = `
      <div class="summary-row">
        <span class="summary-label">Estado de Envío:</span>
        <span class="summary-val"><span class="airtable-badge">✓ Enviado con éxito</span></span>
      </div>
      <div class="summary-row">
        <span class="summary-label">ID Estudiante:</span>
        <span class="summary-val">${escapeHtml(data.id_estudiante)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Nivel de Satisfacción:</span>
        <span class="summary-val">${formatScale(data.nivel_satisfaccion, 'Muy insatisfecho', 'Muy satisfecho')}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Claridad del Contenido:</span>
        <span class="summary-val">${formatScale(data.claridad_contenido, 'Muy poco claro', 'Muy claro')}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Aplicabilidad Práctica:</span>
        <span class="summary-val">${formatScale(data.aplicabilidad_practica, 'Nada aplicable', 'Muy aplicable')}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Comentarios:</span>
        <span class="summary-val">${data.comentarios_adicionales ? escapeHtml(data.comentarios_adicionales) : '<em>Ninguno</em>'}</span>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let isProcessingSubmission = false;

  // Manejar envío
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isProcessingSubmission) return;
    hideAlert();

    const formData = new FormData(form);

    if (!validateForm(formData)) {
      const firstError = form.querySelector('.has-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    currentResponse = {
      id_estudiante: formData.get('id_estudiante').trim(),
      nivel_satisfaccion: formData.get('nivel_satisfaccion'),
      claridad_contenido: formData.get('claridad_contenido'),
      aplicabilidad_practica: formData.get('aplicabilidad_practica'),
      comentarios_adicionales: formData.get('comentarios_adicionales')?.trim() || '',
      _hp_website: formData.get('_hp_website') || '' // Campo trampa anti-spam
    };

    isProcessingSubmission = true;
    setSubmittingState(true);

    try {
      // Envío seguro a través del backend
      const result = await submitSurvey(currentResponse);
      console.log('✅ Encuesta procesada con éxito por el servidor:', result);

      renderSummary(currentResponse);
      modal.classList.remove('hidden');
    } catch (error) {
      console.error('❌ Error al enviar encuesta:', error);
      showAlert(`Hubo un problema al enviar la encuesta: ${error.message}`);
    } finally {
      setSubmittingState(false);
      isProcessingSubmission = false;
    }
  });

  // Botón cerrar modal / nueva respuesta
  closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    form.reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Cerrar modal al hacer clic en el backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      form.reset();
    }
  });
});
